package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 抽奖次数流水的原因
const (
	LotteryTicketReasonClaim  = "claim"  // 每日签到领取
	LotteryTicketReasonDraw   = "draw"   // 抽奖消耗
	LotteryTicketReasonRefund = "refund" // 失败回滚
)

var (
	// ErrLotteryDisabled 签到抽奖未启用
	ErrLotteryDisabled = errors.New("签到抽奖未启用")
	// ErrLotteryNoTicket 没有可用的抽奖次数
	ErrLotteryNoTicket = errors.New("暂无可用抽奖次数，可明日再领取")
)

// CheckinLotteryDraw 抽奖记录
type CheckinLotteryDraw struct {
	Id        int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int     `json:"user_id" gorm:"not null;index:idx_lottery_draw_user"`
	Amount    float64 `json:"amount" gorm:"not null"` // 奖品金额（人民币元）
	Quota     int     `json:"quota" gorm:"not null"`  // 实际发放额度
	CreatedAt int64   `json:"created_at" gorm:"bigint;not null;index:idx_lottery_draw_created"`
}

func (CheckinLotteryDraw) TableName() string {
	return "checkin_lottery_draws"
}

// CheckinLotteryTicket 抽奖次数流水
type CheckinLotteryTicket struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"not null;index:idx_lottery_ticket_user"`
	Delta     int    `json:"delta" gorm:"not null"`                   // +1 领取，-1 消耗
	Reason    string `json:"reason" gorm:"type:varchar(32);not null"` // claim / draw / refund
	CreatedAt int64  `json:"created_at" gorm:"bigint;not null"`
}

func (CheckinLotteryTicket) TableName() string {
	return "checkin_lottery_tickets"
}

// CheckinLotteryTicketState 抽奖次数余额，用于并发安全的原子扣减
type CheckinLotteryTicketState struct {
	UserId    int   `json:"user_id" gorm:"primaryKey"`
	Tickets   int   `json:"tickets" gorm:"not null;default:0"`
	TouchedAt int64 `json:"touched_at" gorm:"bigint;not null;default:0"`
}

func (CheckinLotteryTicketState) TableName() string {
	return "checkin_lottery_ticket_states"
}

// GetUserLotteryTickets 获取用户可用抽奖次数
func GetUserLotteryTickets(userId int) (int, error) {
	var state CheckinLotteryTicketState
	err := DB.Where("user_id = ?", userId).First(&state).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	if state.Tickets < 0 {
		return 0, nil
	}
	return state.Tickets, nil
}

// AddUserLotteryTickets 增加抽奖次数并写入次数流水
func AddUserLotteryTickets(db *gorm.DB, userId int, delta int, reason string) error {
	if db == nil {
		db = DB
	}
	now := time.Now().Unix()
	err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			"tickets":    gorm.Expr("tickets + ?", delta),
			"touched_at": now,
		}),
	}).Create(&CheckinLotteryTicketState{
		UserId:    userId,
		Tickets:   delta,
		TouchedAt: now,
	}).Error
	if err != nil {
		return err
	}
	return db.Create(&CheckinLotteryTicket{
		UserId:    userId,
		Delta:     delta,
		Reason:    reason,
		CreatedAt: now,
	}).Error
}

// deductUserLotteryTicket 原子扣减一次抽奖次数，返回是否扣减成功
func deductUserLotteryTicket(db *gorm.DB, userId int) (bool, error) {
	if db == nil {
		db = DB
	}
	result := db.Model(&CheckinLotteryTicketState{}).
		Where("user_id = ? AND tickets > 0", userId).
		Update("tickets", gorm.Expr("tickets - 1"))
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

// DrawUserLottery 执行一次抽奖
//
// MySQL / PostgreSQL 使用事务保证原子性；SQLite 不支持嵌套事务，
// 使用顺序操作 + 手动回滚（与签到保持一致）。
func DrawUserLottery(userId int) (*CheckinLotteryDraw, error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return nil, ErrLotteryDisabled
	}

	prize, err := operation_setting.PickCheckinPrize()
	if err != nil {
		return nil, err
	}

	draw := &CheckinLotteryDraw{
		UserId:    userId,
		Amount:    prize.Amount,
		Quota:     operation_setting.CheckinPrizeQuota(prize.Amount),
		CreatedAt: time.Now().Unix(),
	}

	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		return drawUserLotteryWithoutTransaction(userId, draw)
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		ok, err := deductUserLotteryTicket(tx, userId)
		if err != nil {
			return errors.New("抽奖失败，请稍后重试")
		}
		if !ok {
			return ErrLotteryNoTicket
		}
		if err := tx.Create(draw).Error; err != nil {
			return errors.New("抽奖失败，请稍后重试")
		}
		if err := tx.Create(&CheckinLotteryTicket{
			UserId:    userId,
			Delta:     -1,
			Reason:    LotteryTicketReasonDraw,
			CreatedAt: draw.CreatedAt,
		}).Error; err != nil {
			return errors.New("抽奖失败，请稍后重试")
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", draw.Quota)).Error; err != nil {
			return errors.New("抽奖失败：发放奖励出错")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	go func() {
		_ = cacheIncrUserQuota(userId, int64(draw.Quota))
	}()

	return draw, nil
}

// drawUserLotteryWithoutTransaction 不使用事务执行抽奖（适用于 SQLite）
func drawUserLotteryWithoutTransaction(userId int, draw *CheckinLotteryDraw) (*CheckinLotteryDraw, error) {
	rollback := func() {
		_ = AddUserLotteryTickets(nil, userId, 1, LotteryTicketReasonRefund)
	}

	ok, err := deductUserLotteryTicket(nil, userId)
	if err != nil {
		return nil, errors.New("抽奖失败，请稍后重试")
	}
	if !ok {
		return nil, ErrLotteryNoTicket
	}

	if err := DB.Create(draw).Error; err != nil {
		rollback()
		return nil, errors.New("抽奖失败，请稍后重试")
	}

	if err := DB.Create(&CheckinLotteryTicket{
		UserId:    userId,
		Delta:     -1,
		Reason:    LotteryTicketReasonDraw,
		CreatedAt: draw.CreatedAt,
	}).Error; err != nil {
		DB.Delete(draw)
		rollback()
		return nil, errors.New("抽奖失败，请稍后重试")
	}

	if err := IncreaseUserQuota(userId, draw.Quota, true); err != nil {
		DB.Delete(draw)
		rollback()
		return nil, errors.New("抽奖失败：发放奖励出错")
	}

	return draw, nil
}

// GetUserLotteryStats 获取用户抽奖统计
func GetUserLotteryStats(userId int) (map[string]any, error) {
	var totalDraws int64
	if err := DB.Model(&CheckinLotteryDraw{}).Where("user_id = ?", userId).
		Count(&totalDraws).Error; err != nil {
		return nil, err
	}

	var totals struct {
		TotalAmount float64
		BestAmount  float64
	}
	if err := DB.Model(&CheckinLotteryDraw{}).Where("user_id = ?", userId).
		Select("COALESCE(SUM(amount), 0) AS total_amount, COALESCE(MAX(amount), 0) AS best_amount").
		Scan(&totals).Error; err != nil {
		return nil, err
	}

	return map[string]any{
		"total_draws":  totalDraws,
		"total_amount": totals.TotalAmount,
		"best_amount":  totals.BestAmount,
	}, nil
}

// LotteryLeaderboardEntry 手气榜条目
type LotteryLeaderboardEntry struct {
	Rank        int     `json:"rank"`
	UserId      int     `json:"user_id"`
	Account     string  `json:"account"`
	Draws       int     `json:"draws"`
	BestAmount  float64 `json:"best_amount"`
	TotalAmount float64 `json:"total_amount"`
}

// GetLotteryLeaderboard 获取手气榜前 N 名（按累计中奖金额排序）
func GetLotteryLeaderboard(limit int) ([]LotteryLeaderboardEntry, error) {
	if limit <= 0 {
		limit = 10
	}

	var rows []struct {
		UserId      int
		Draws       int
		BestAmount  float64
		TotalAmount float64
	}
	err := DB.Model(&CheckinLotteryDraw{}).
		Select("user_id, COUNT(*) AS draws, COALESCE(MAX(amount), 0) AS best_amount, COALESCE(SUM(amount), 0) AS total_amount").
		Group("user_id").
		Order("total_amount DESC, draws ASC, user_id ASC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	userIds := make([]int, 0, len(rows))
	for _, row := range rows {
		userIds = append(userIds, row.UserId)
	}
	labels := lotteryAccountLabels(userIds)

	entries := make([]LotteryLeaderboardEntry, 0, len(rows))
	for index, row := range rows {
		account := labels[row.UserId]
		if account == "" {
			account = "***"
		}
		entries = append(entries, LotteryLeaderboardEntry{
			Rank:        index + 1,
			UserId:      row.UserId,
			Account:     account,
			Draws:       row.Draws,
			BestAmount:  row.BestAmount,
			TotalAmount: row.TotalAmount,
		})
	}
	return entries, nil
}

// GetUserLotteryRank 获取用户在手气榜中的排名（按累计中奖金额），未上榜返回 0
func GetUserLotteryRank(userId int) (int, float64, error) {
	var mine struct {
		TotalAmount float64
	}
	if err := DB.Model(&CheckinLotteryDraw{}).Where("user_id = ?", userId).
		Select("COALESCE(SUM(amount), 0) AS total_amount").
		Scan(&mine).Error; err != nil {
		return 0, 0, err
	}
	if mine.TotalAmount <= 0 {
		return 0, 0, nil
	}

	var ahead int64
	if err := DB.Table("(SELECT user_id, SUM(amount) AS total_amount FROM checkin_lottery_draws GROUP BY user_id) AS t").
		Where("t.total_amount > ?", mine.TotalAmount).
		Count(&ahead).Error; err != nil {
		return 0, mine.TotalAmount, err
	}

	return int(ahead) + 1, mine.TotalAmount, nil
}

// lotteryAccountLabels 获取脱敏后的用户展示名
func lotteryAccountLabels(userIds []int) map[int]string {
	labels := make(map[int]string, len(userIds))
	if len(userIds) == 0 {
		return labels
	}

	var users []struct {
		Id       int
		Username string
		Email    string
	}
	if err := DB.Model(&User{}).Select("id, username, email").
		Where("id IN ?", userIds).Scan(&users).Error; err != nil {
		return labels
	}
	for _, user := range users {
		labels[user.Id] = MaskLotteryAccount(user.Username, user.Email)
	}
	return labels
}

// MaskLotteryAccount 脱敏展示账号，例如 r***@g***.com 或 p***1
func MaskLotteryAccount(username, email string) string {
	email = strings.TrimSpace(email)
	if at := strings.LastIndex(email, "@"); at > 0 {
		local := email[:at]
		domain := email[at+1:]
		segments := strings.Split(domain, ".")
		maskedDomain := maskLotterySegment(segments[0])
		if len(segments) > 1 {
			maskedDomain += "." + strings.Join(segments[1:], ".")
		}
		return maskLotterySegment(local) + "@" + maskedDomain
	}

	runes := []rune(strings.TrimSpace(username))
	switch len(runes) {
	case 0:
		return "***"
	case 1:
		return string(runes[0]) + "***"
	default:
		return string(runes[0]) + "***" + string(runes[len(runes)-1])
	}
}

// maskLotterySegment 保留首字符，其余用 *** 替代
func maskLotterySegment(value string) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) == 0 {
		return "***"
	}
	return string(runes[0]) + "***"
}
