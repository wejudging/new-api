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
	LotteryTicketReasonClaim    = "claim"    // 每日签到领取
	LotteryTicketReasonDraw     = "draw"     // 抽奖消耗
	LotteryTicketReasonRefund   = "refund"   // 失败回滚
	LotteryTicketReasonTopUp    = "topup"    // 充值赠送
	LotteryTicketReasonReferral = "referral" // 邀请好友首充奖励
)

// 抽奖次数池对应的数据库列名
const (
	lotteryTicketPoolDaily = "daily_tickets"
	lotteryTicketPoolBonus = "tickets"
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
//
// 次数分成两个池子：
//   - DailyTickets 每日签到领取的次数，封顶为每日上限、不可累加（没用掉不会攒到第二天）；
//   - BonusTickets 充值赠送的次数，永久有效、可累加。
//
// BonusTickets 复用历史字段名 tickets，避免升级时丢掉已有余额。
type CheckinLotteryTicketState struct {
	UserId         int   `json:"user_id" gorm:"primaryKey"`
	DailyTickets   int   `json:"daily_tickets" gorm:"not null;default:0"`
	BonusTickets   int   `json:"bonus_tickets" gorm:"column:tickets;not null;default:0"`
	TopUpRemainder int64 `json:"topup_remainder" gorm:"bigint;not null;default:0"` // 累计充值赠送的余量（额度）
	TouchedAt      int64 `json:"touched_at" gorm:"bigint;not null;default:0"`
}

func (CheckinLotteryTicketState) TableName() string {
	return "checkin_lottery_ticket_states"
}

// GetUserLotteryTickets 获取用户可用抽奖次数
func GetUserLotteryTickets(userId int) (int, error) {
	daily, bonus, err := GetUserLotteryTicketBuckets(userId)
	if err != nil {
		return 0, err
	}
	return daily + bonus, nil
}

// GetUserLotteryTicketBuckets 分别获取每日次数与充值赠送次数
func GetUserLotteryTicketBuckets(userId int) (daily int, bonus int, err error) {
	var state CheckinLotteryTicketState
	err = DB.Where("user_id = ?", userId).First(&state).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, 0, nil
	}
	if err != nil {
		return 0, 0, err
	}
	if state.DailyTickets < 0 {
		state.DailyTickets = 0
	}
	if state.BonusTickets < 0 {
		state.BonusTickets = 0
	}
	return state.DailyTickets, state.BonusTickets, nil
}

// ensureLotteryTicketState 确保用户有一行次数余额记录并加锁
func ensureLotteryTicketState(db *gorm.DB, userId int) (*CheckinLotteryTicketState, error) {
	if db == nil {
		db = DB
	}

	state := &CheckinLotteryTicketState{UserId: userId}
	err := lockForUpdate(db).Where("user_id = ?", userId).First(state).Error
	if err == nil {
		return state, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// 并发场景下另一个请求可能刚插入同一行，冲突时回退到读取。
	err = db.Clauses(clause.OnConflict{DoNothing: true}).Create(state).Error
	if err != nil {
		return nil, err
	}
	state = &CheckinLotteryTicketState{UserId: userId}
	if err := lockForUpdate(db).Where("user_id = ?", userId).First(state).Error; err != nil {
		return nil, err
	}
	return state, nil
}

// addUserLotteryTicketsTo 在指定的次数池上增加次数并写入次数流水
func addUserLotteryTicketsTo(db *gorm.DB, userId int, pool string, delta int, reason string) error {
	if db == nil {
		db = DB
	}
	now := time.Now().Unix()
	state := &CheckinLotteryTicketState{UserId: userId, TouchedAt: now}
	if pool == lotteryTicketPoolDaily {
		state.DailyTickets = delta
	} else {
		state.BonusTickets = delta
	}
	err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			// 列名必须带表名：ON CONFLICT ... DO UPDATE 里的裸列名在 PostgreSQL
			// 属于歧义引用（SQLSTATE 42702），报错后事务会被标记为 aborted，
			// 调用方（含充值）的 COMMIT 随即失败并整笔回滚。
			pool:         gorm.Expr("checkin_lottery_ticket_states."+pool+" + ?", delta),
			"touched_at": now,
		}),
	}).Create(state).Error
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

// GrantDailyLotteryTickets 领取当日抽奖次数
//
// 每日次数不可累加：只会把每日池补到每日上限，昨天没用掉的次数不会叠加。
// 返回本次实际新增的次数（已经在每日上限时返回 0）。
func GrantDailyLotteryTickets(db *gorm.DB, userId int, dailyDraws int) (int, error) {
	if dailyDraws <= 0 {
		dailyDraws = 1
	}
	state, err := ensureLotteryTicketState(db, userId)
	if err != nil {
		return 0, err
	}
	if state.DailyTickets >= dailyDraws {
		return 0, nil
	}
	delta := dailyDraws - state.DailyTickets
	if err := addUserLotteryTicketsTo(db, userId, lotteryTicketPoolDaily, delta, LotteryTicketReasonClaim); err != nil {
		return 0, err
	}
	return delta, nil
}

// GrantTopUpLotteryTickets 按累计充值到账额度赠送抽奖次数（不参与每日封顶，也不会过期）
//
// 只受赠送门槛控制（门槛 <= 0 即关闭），与「启用签到」开关无关：
// 抽奖功能临时关闭时赠送的次数会留着，重新开启后依然可用。
func GrantTopUpLotteryTickets(db *gorm.DB, userId int, creditedQuota int) (int, error) {
	if db == nil {
		db = DB
	}
	if operation_setting.GetCheckinTopUpStepQuota() <= 0 || creditedQuota <= 0 {
		return 0, nil
	}

	state, err := ensureLotteryTicketState(db, userId)
	if err != nil {
		return 0, err
	}

	granted, remainder := operation_setting.SplitCheckinTopUpTickets(state.TopUpRemainder, creditedQuota)
	if granted <= 0 && remainder == state.TopUpRemainder {
		return 0, nil
	}

	if granted > 0 {
		if err := addUserLotteryTicketsTo(db, userId, lotteryTicketPoolBonus, granted, LotteryTicketReasonTopUp); err != nil {
			return 0, err
		}
	}
	// 列名必须是 GORM 由字段名推导出的 top_up_remainder：写成 topup_remainder
	// 会命中不存在的列（SQLSTATE 42703），赠送次数因此永远结算不完。
	err = db.Model(&CheckinLotteryTicketState{}).Where("user_id = ?", userId).
		Update("top_up_remainder", remainder).Error
	if err != nil {
		return 0, err
	}
	return granted, nil
}

// deductUserLotteryTicket 原子扣减一次抽奖次数，优先消耗每日次数（会过期的先花）
func deductUserLotteryTicket(db *gorm.DB, userId int) (fromDaily bool, ok bool, err error) {
	if db == nil {
		db = DB
	}
	result := db.Model(&CheckinLotteryTicketState{}).
		Where("user_id = ? AND daily_tickets > 0", userId).
		Update("daily_tickets", gorm.Expr("daily_tickets - 1"))
	if result.Error != nil {
		return false, false, result.Error
	}
	if result.RowsAffected == 1 {
		return true, true, nil
	}

	result = db.Model(&CheckinLotteryTicketState{}).
		Where("user_id = ? AND tickets > 0", userId).
		Update("tickets", gorm.Expr("tickets - 1"))
	if result.Error != nil {
		return false, false, result.Error
	}
	return false, result.RowsAffected == 1, nil
}

// refundUserLotteryTicket 归还一次抽奖次数到它原本所属的次数池
func refundUserLotteryTicket(db *gorm.DB, userId int, fromDaily bool) error {
	pool := lotteryTicketPoolBonus
	if fromDaily {
		pool = lotteryTicketPoolDaily
	}
	return addUserLotteryTicketsTo(db, userId, pool, 1, LotteryTicketReasonRefund)
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
		_, ok, err := deductUserLotteryTicket(tx, userId)
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
	rollback := func(fromDaily bool) {
		_ = refundUserLotteryTicket(nil, userId, fromDaily)
	}

	fromDaily, ok, err := deductUserLotteryTicket(nil, userId)
	if err != nil {
		return nil, errors.New("抽奖失败，请稍后重试")
	}
	if !ok {
		return nil, ErrLotteryNoTicket
	}

	if err := DB.Create(draw).Error; err != nil {
		rollback(fromDaily)
		return nil, errors.New("抽奖失败，请稍后重试")
	}

	if err := DB.Create(&CheckinLotteryTicket{
		UserId:    userId,
		Delta:     -1,
		Reason:    LotteryTicketReasonDraw,
		CreatedAt: draw.CreatedAt,
	}).Error; err != nil {
		DB.Delete(draw)
		rollback(fromDaily)
		return nil, errors.New("抽奖失败，请稍后重试")
	}

	if err := IncreaseUserQuota(userId, draw.Quota, true); err != nil {
		DB.Delete(draw)
		rollback(fromDaily)
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

// GetUserLotteryDraws 分页获取用户的抽奖记录（最新在前）
func GetUserLotteryDraws(userId int, pageInfo *common.PageInfo) (draws []*CheckinLotteryDraw, total int64, err error) {
	err = DB.Model(&CheckinLotteryDraw{}).Where("user_id = ?", userId).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = DB.Where("user_id = ?", userId).
		Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&draws).Error
	if err != nil {
		return nil, 0, err
	}
	return draws, total, nil
}

// GetUserLotteryTicketLogs 分页获取用户的抽奖次数流水（最新在前）
func GetUserLotteryTicketLogs(userId int, pageInfo *common.PageInfo) (tickets []*CheckinLotteryTicket, total int64, err error) {
	err = DB.Model(&CheckinLotteryTicket{}).Where("user_id = ?", userId).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = DB.Where("user_id = ?", userId).
		Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&tickets).Error
	if err != nil {
		return nil, 0, err
	}
	return tickets, total, nil
}

// LotteryLeaderboardEntry 手气榜条目
type LotteryLeaderboardEntry struct {
	Rank        int     `json:"rank"`
	UserId      int     `json:"user_id"`
	Username    string  `json:"username"`
	Account     string  `json:"account"`
	Draws       int     `json:"draws"`
	BestAmount  float64 `json:"best_amount"`
	TotalAmount float64 `json:"total_amount"`
}

// GetLotteryLeaderboard 获取手气榜前 N 名（按累计中奖金额排序）
func GetLotteryLeaderboard(limit int) ([]LotteryLeaderboardEntry, error) {
	if limit <= 0 {
		limit = 20
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
		label := labels[row.UserId]
		username := label.Username
		if username == "" {
			username = "***"
		}
		entries = append(entries, LotteryLeaderboardEntry{
			Rank:        index + 1,
			UserId:      row.UserId,
			Username:    username,
			Account:     label.Email,
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

// lotteryAccountLabel 手气榜展示用的账号信息：半隐藏用户名 + 脱敏邮箱
type lotteryAccountLabel struct {
	Username string
	Email    string
}

// lotteryAccountLabels 获取手气榜展示用的用户名与脱敏邮箱
//
// 用户名与邮箱都在服务端脱敏：榜单对所有登录用户可见，接口不能把完整账号信息发出去，
// 只在前端打码的话任何人直接请求接口就能拿到原文。
func lotteryAccountLabels(userIds []int) map[int]lotteryAccountLabel {
	labels := make(map[int]lotteryAccountLabel, len(userIds))
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
		labels[user.Id] = lotteryAccountLabel{
			Username: MaskLotteryUsername(user.Username),
			Email:    MaskLotteryEmail(user.Email),
		}
	}
	return labels
}

// MaskLotteryUsername 半隐藏展示用户名：保留首尾字符，中间用 *** 替代
//
// 例如 hohai -> h***i、张三丰 -> 张***丰。太短的用户名没有中间部分可用，
// 就只保留首位、其余全部打码，避免把整个用户名露出来。
func MaskLotteryUsername(username string) string {
	runes := []rune(strings.TrimSpace(username))
	switch len(runes) {
	case 0:
		return ""
	case 1:
		return "*"
	case 2:
		return string(runes[0]) + "***"
	default:
		return string(runes[0]) + "***" + string(runes[len(runes)-1])
	}
}

// MaskLotteryEmail 脱敏展示邮箱，例如 r***@g***.com；没有邮箱时返回空串
func MaskLotteryEmail(email string) string {
	email = strings.TrimSpace(email)
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return ""
	}
	local := email[:at]
	domain := email[at+1:]
	segments := strings.Split(domain, ".")
	maskedDomain := maskLotterySegment(segments[0])
	if len(segments) > 1 {
		maskedDomain += "." + strings.Join(segments[1:], ".")
	}
	return maskLotterySegment(local) + "@" + maskedDomain
}

// maskLotterySegment 保留首字符，其余用 *** 替代
func maskLotterySegment(value string) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) == 0 {
		return "***"
	}
	return string(runes[0]) + "***"
}
