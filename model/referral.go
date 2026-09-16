package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ReferralReward 邀请奖励结算记录
//
// 奖励不再走余额返利，而是「好友首次充值成功后，邀请双方各得抽奖次数」。
// InviteeId 带唯一索引，因此同一位被邀请人无论回调重复多少次、并发多少次，
// 都只会结算一次；这也是整个邀请奖励的幂等保证。
type ReferralReward struct {
	Id            int   `json:"id" gorm:"primaryKey;autoIncrement"`
	InviterId     int   `json:"inviter_id" gorm:"not null;index:idx_referral_inviter"`
	InviteeId     int   `json:"invitee_id" gorm:"not null;uniqueIndex:idx_referral_invitee"`
	CreditedQuota int   `json:"credited_quota" gorm:"not null;default:0"` // 触发结算的到账额度
	Tickets       int   `json:"tickets" gorm:"not null;default:0"`        // 双方各得的抽奖次数
	CreatedAt     int64 `json:"created_at" gorm:"bigint;not null;index:idx_referral_created"`
}

func (ReferralReward) TableName() string {
	return "referral_rewards"
}

// ReferralInvitee 邀请记录里的一位被邀请人
type ReferralInvitee struct {
	UserId        int    `json:"user_id"`
	Username      string `json:"username"`
	RegisteredAt  int64  `json:"registered_at"`
	Settled       bool   `json:"settled"`
	Tickets       int    `json:"tickets"`
	CreditedQuota int    `json:"credited_quota"`
	SettledAt     int64  `json:"settled_at"`
}

// SettleReferralLotteryTickets 结算「好友首次充值」的邀请抽奖次数
//
// 触发条件：被邀请人有一笔充值到账、且这位被邀请人还没有结算记录。
// 结算金额：双方各得 GetCheckinReferralTickets(到账额度) 次，两份是独立的
// 权益 —— 被邀请人除了这份邀请次数，仍然照常拿自己的「充值赠送」次数。
// 只结算一次，所以这份多出来的次数仅限于首次充值那一刻。
// 返回值为双方各得的次数（本次没有结算时返回 0）。
func SettleReferralLotteryTickets(db *gorm.DB, inviteeId int, creditedQuota int) (int, error) {
	if db == nil {
		db = DB
	}
	if inviteeId <= 0 {
		return 0, nil
	}

	tickets := operation_setting.GetCheckinReferralTickets(creditedQuota)
	if tickets <= 0 {
		return 0, nil
	}

	var invitee User
	if err := db.Select("id", "inviter_id").First(&invitee, "id = ?", inviteeId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	// 没有邀请人、或邀请人就是自己（自邀）时不结算
	if invitee.InviterId <= 0 || invitee.InviterId == inviteeId {
		return 0, nil
	}

	reward := ReferralReward{
		InviterId:     invitee.InviterId,
		InviteeId:     inviteeId,
		CreditedQuota: creditedQuota,
		Tickets:       tickets,
		CreatedAt:     time.Now().Unix(),
	}
	// 唯一索引挡重复：并发/重复回调时只有一条能写进去，写不进去就是已经结算过。
	result := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&reward)
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected == 0 {
		return 0, nil
	}

	if err := addUserLotteryTicketsTo(db, invitee.InviterId, lotteryTicketPoolBonus, tickets, LotteryTicketReasonReferral); err != nil {
		return 0, err
	}
	if err := addUserLotteryTicketsTo(db, inviteeId, lotteryTicketPoolBonus, tickets, LotteryTicketReasonReferral); err != nil {
		return 0, err
	}
	return tickets, nil
}

// GetUserReferralTickets 我通过邀请好友累计获得的抽奖次数
func GetUserReferralTickets(userId int) (int, error) {
	if userId <= 0 {
		return 0, nil
	}
	var total int64
	err := DB.Model(&ReferralReward{}).
		Where("inviter_id = ?", userId).
		Select("COALESCE(SUM(tickets), 0)").
		Scan(&total).Error
	if err != nil {
		return 0, err
	}
	return int(total), nil
}

// GetUserReferralRewardedCount 我邀请的好友中已经结算过奖励的人数
func GetUserReferralRewardedCount(userId int) (int, error) {
	if userId <= 0 {
		return 0, nil
	}
	var count int64
	err := DB.Model(&ReferralReward{}).Where("inviter_id = ?", userId).Count(&count).Error
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

// GetUserInviteeCount 我邀请注册的用户数（按邀请关系实时统计）
func GetUserInviteeCount(userId int) (int, error) {
	if userId <= 0 {
		return 0, nil
	}
	var count int64
	if err := DB.Model(&User{}).Where("inviter_id = ?", userId).Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}

// GetUserReferralInvitees 我邀请的用户列表（含是否已经结算）
//
// 用户名按手气榜的规则半隐藏，被邀请人的隐私不会完整暴露给邀请人。
func GetUserReferralInvitees(userId int, limit int) ([]ReferralInvitee, error) {
	if userId <= 0 {
		return []ReferralInvitee{}, nil
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var users []struct {
		Id        int
		Username  string
		CreatedAt int64
	}
	err := DB.Model(&User{}).
		Select("id", "username", "created_at").
		Where("inviter_id = ?", userId).
		Order("id DESC").
		Limit(limit).
		Scan(&users).Error
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return []ReferralInvitee{}, nil
	}

	ids := make([]int, 0, len(users))
	for _, user := range users {
		ids = append(ids, user.Id)
	}

	var rewards []ReferralReward
	if err := DB.Where("invitee_id IN ?", ids).Find(&rewards).Error; err != nil {
		return nil, err
	}
	byInvitee := make(map[int]ReferralReward, len(rewards))
	for _, reward := range rewards {
		byInvitee[reward.InviteeId] = reward
	}

	invitees := make([]ReferralInvitee, 0, len(users))
	for _, user := range users {
		entry := ReferralInvitee{
			UserId:       user.Id,
			Username:     MaskLotteryUsername(user.Username),
			RegisteredAt: user.CreatedAt,
		}
		if reward, ok := byInvitee[user.Id]; ok {
			entry.Settled = true
			entry.Tickets = reward.Tickets
			entry.CreditedQuota = reward.CreditedQuota
			entry.SettledAt = reward.CreatedAt
		}
		invitees = append(invitees, entry)
	}
	return invitees, nil
}

// EnsureUserAffCode 读取用户的邀请码，没有就补发一个（邀请链接依赖它）
func EnsureUserAffCode(userId int) (string, error) {
	if userId <= 0 {
		return "", nil
	}
	var user User
	if err := DB.Select("id", "aff_code").First(&user, "id = ?", userId).Error; err != nil {
		return "", err
	}
	if user.AffCode != "" {
		return user.AffCode, nil
	}

	// 邀请码带唯一索引，随机撞码时重试几次；仍然失败就返回空码，前端隐藏邀请链接。
	for i := 0; i < 3; i++ {
		code := common.GetRandomString(4)
		result := DB.Model(&User{}).Where("id = ? AND (aff_code = '' OR aff_code IS NULL)", userId).
			Update("aff_code", code)
		if result.Error != nil {
			return "", result.Error
		}
		if result.RowsAffected == 1 {
			return code, nil
		}
		var latest User
		if err := DB.Select("id", "aff_code").First(&latest, "id = ?", userId).Error; err != nil {
			return "", err
		}
		if latest.AffCode != "" {
			return latest.AffCode, nil
		}
	}
	return "", nil
}
