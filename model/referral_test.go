package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// withReferralBaseTickets 在测试期间调整邀请保底次数，结束后恢复
func withReferralBaseTickets(t *testing.T, base int) {
	t.Helper()
	setting := operation_setting.GetCheckinSetting()
	original := setting.ReferralBaseTickets
	setting.ReferralBaseTickets = base
	t.Cleanup(func() {
		setting.ReferralBaseTickets = original
	})
}

func migrateReferralTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(
		&ReferralReward{},
		&CheckinLotteryTicketState{},
		&CheckinLotteryTicket{},
	))
}

// seedReferralPair 造一对邀请关系：返回邀请人与被邀请人
func seedReferralPair(t *testing.T, inviterId int, inviteeId int) (User, User) {
	t.Helper()
	inviter := User{
		Id:          inviterId,
		Password:    "unused-password-hash",
		Username:    "referral-inviter-" + common.GetRandomString(4),
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     "r" + common.GetRandomString(4),
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&inviter).Error)

	invitee := User{
		Id:          inviteeId,
		Password:    "unused-password-hash",
		Username:    "referral-invitee-" + common.GetRandomString(4),
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     "i" + common.GetRandomString(4),
		InviterId:   inviterId,
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&invitee).Error)
	return inviter, invitee
}

// bonusTicketsOf 读取用户当前可用的赠送次数
func bonusTicketsOf(t *testing.T, userId int) int {
	t.Helper()
	state := &CheckinLotteryTicketState{}
	err := DB.Where("user_id = ?", userId).First(state).Error
	if err != nil {
		require.ErrorIs(t, err, gorm.ErrRecordNotFound, "user_id=%d", userId)
		return 0
	}
	return state.BonusTickets
}

// referralLedgerOf 读取用户流水里邀请奖励的累计次数
func referralLedgerOf(t *testing.T, userId int) int {
	t.Helper()
	var total int64
	require.NoError(t, DB.Model(&CheckinLotteryTicket{}).
		Where("user_id = ? AND reason = ?", userId, LotteryTicketReasonReferral).
		Select("COALESCE(SUM(delta), 0)").
		Scan(&total).Error)
	return int(total)
}

// TestSettleReferralLotteryTicketsPaysBothSidesOnASmallFirstTopUp 覆盖小额首充的基础奖励。
//
// 到账金额不足一次「充值赠送门槛」时，被邀请人自己拿不到充值赠送，但邀请关系
// 依然要生效：双方各得后台配置的基础邀请次数。
func TestSettleReferralLotteryTicketsPaysBothSidesOnASmallFirstTopUp(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	inviter, invitee := seedReferralPair(t, 990301, 990302)
	step := operation_setting.GetCheckinTopUpStepQuota()
	require.Greater(t, step, 0)

	// 首充 5 元：不足一个档位，双方各得基础的 1 次
	granted, err := SettleReferralLotteryTickets(DB, invitee.Id, step/2)
	require.NoError(t, err)
	require.Equal(t, 1, granted)

	require.Equal(t, 1, bonusTicketsOf(t, inviter.Id))
	require.Equal(t, 1, bonusTicketsOf(t, invitee.Id))
	require.Equal(t, 1, referralLedgerOf(t, inviter.Id))
	require.Equal(t, 1, referralLedgerOf(t, invitee.Id))
}

// TestSettleReferralLotteryTicketsStacksWithTheTopUpGrant 覆盖达标首充的奖励。
//
// 到账 25 元 = 2 个档位，邀请双方各得「基础 1 次 + 2 次」= 3 次；这份邀请次数
// 是被邀请人的独立权益，不会抵扣掉他本来就有的充值赠送次数（首充那一笔两份都
// 拿，仅限首次）。
func TestSettleReferralLotteryTicketsStacksWithTheTopUpGrant(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	inviter, invitee := seedReferralPair(t, 990311, 990312)
	step := operation_setting.GetCheckinTopUpStepQuota()

	// 先走一遍普通用户都会经历的充值赠送
	topUpGranted, err := GrantTopUpLotteryTickets(DB, invitee.Id, step*2+step/2)
	require.NoError(t, err)
	require.Equal(t, 2, topUpGranted)

	granted, err := SettleReferralLotteryTickets(DB, invitee.Id, step*2+step/2)
	require.NoError(t, err)
	require.Equal(t, 3, granted, "25 元首充双方各得基础 1 次 + 2 次")

	require.Equal(t, 3, bonusTicketsOf(t, inviter.Id))
	require.Equal(t, 5, bonusTicketsOf(t, invitee.Id), "被邀请人两份都拿：充值赠送 2 次 + 邀请 3 次")
	require.Equal(t, 3, referralLedgerOf(t, invitee.Id), "被邀请人也要留下邀请流水")

	var reward ReferralReward
	require.NoError(t, DB.Where("invitee_id = ?", invitee.Id).First(&reward).Error)
	require.Equal(t, 3, reward.Tickets)
}

// TestSettleReferralLotteryTicketsPaysTheInviteeTwiceTheStepTickets 锁定对外承诺。
//
// 同一笔首充，被邀请人到手的次数是「邀请奖励 + 他自己的充值赠送」，所以档位奖励
// 部分是邀请人的两倍：
//
//	首充 10 元  → 邀请人 2 次、被邀请人 3 次
//	首充 100 元 → 邀请人 11 次、被邀请人 21 次
func TestSettleReferralLotteryTicketsPaysTheInviteeTwiceTheStepTickets(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	inviter, invitee := seedReferralPair(t, 990371, 990372)
	step := operation_setting.GetCheckinTopUpStepQuota()

	// 一笔 100 元首充走完整链路：到账 + 充值赠送 + 邀请奖励
	require.NoError(t, creditTopUpQuotaWithLottery(DB, invitee.Id, step*10, map[string]any{}))

	require.Equal(t, 11, bonusTicketsOf(t, inviter.Id), "邀请人：基础 1 次 + 10 次")
	require.Equal(t, 21, bonusTicketsOf(t, invitee.Id), "被邀请人：邀请 11 次 + 自己的充值赠送 10 次")
}

// TestSettleReferralLotteryTicketsSettlesOnlyOnce 覆盖重复回调的幂等性。
//
// 支付回调可能重复到达，结算必须只发生一次，否则邀请人和被邀请人都能靠
// 重放回调刷出无限抽奖次数。
func TestSettleReferralLotteryTicketsSettlesOnlyOnce(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	inviter, invitee := seedReferralPair(t, 990321, 990322)
	step := operation_setting.GetCheckinTopUpStepQuota()

	for i := 0; i < 5; i++ {
		granted, err := SettleReferralLotteryTickets(DB, invitee.Id, step)
		require.NoError(t, err)
		if i == 0 {
			require.Equal(t, 2, granted, "10 元首充：基础 1 次 + 1 个档位")
			continue
		}
		require.Equal(t, 0, granted, "重复结算必须直接跳过")
	}

	var rewards int64
	require.NoError(t, DB.Model(&ReferralReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Equal(t, int64(1), rewards)
	require.Equal(t, 2, bonusTicketsOf(t, inviter.Id))
}

// TestSettleReferralLotteryTicketsConcurrentCallbacksPayOnce 覆盖并发回调。
//
// 同一笔首充的回调可能被并发重放，唯一索引是唯一的挡板：并发时也只能有一条
// 结算记录存活，因此也只有一次发奖。
func TestSettleReferralLotteryTicketsConcurrentCallbacksPayOnce(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	inviter, invitee := seedReferralPair(t, 990331, 990332)
	step := operation_setting.GetCheckinTopUpStepQuota()

	const workers = 6
	var waitGroup sync.WaitGroup
	start := make(chan struct{})
	grantedTotal := make([]int, workers)
	errs := make([]error, workers)
	for i := 0; i < workers; i++ {
		waitGroup.Add(1)
		go func(index int) {
			defer waitGroup.Done()
			<-start
			grantedTotal[index], errs[index] = SettleReferralLotteryTickets(DB, invitee.Id, step*2)
		}(i)
	}
	close(start)
	waitGroup.Wait()

	sum := 0
	for index := 0; index < workers; index++ {
		require.NoError(t, errs[index], "并发结算不应报错，index=%d", index)
		sum += grantedTotal[index]
	}
	require.Equal(t, 3, sum, "并发回调也只允许发一次奖（基础 1 次 + 2 个档位）")
	require.Equal(t, 3, bonusTicketsOf(t, inviter.Id))

	var rewards int64
	require.NoError(t, DB.Model(&ReferralReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Equal(t, int64(1), rewards)
}

// TestSettleReferralLotteryTicketsSkipsSelfInvite 覆盖没有邀请关系的情形。
//
// 自己邀请自己、或邀请人为空（老数据）时都不该发奖。
func TestSettleReferralLotteryTicketsSkipsSelfInvite(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	step := operation_setting.GetCheckinTopUpStepQuota()

	selfInvite := User{
		Id:          990341,
		Password:    "unused-password-hash",
		Username:    "referral-self-" + common.GetRandomString(4),
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     "s" + common.GetRandomString(4),
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&selfInvite).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", selfInvite.Id).Update("inviter_id", selfInvite.Id).Error)

	granted, err := SettleReferralLotteryTickets(DB, selfInvite.Id, step*2)
	require.NoError(t, err)
	require.Equal(t, 0, granted)

	orphan := User{
		Id:          990342,
		Password:    "unused-password-hash",
		Username:    "referral-orphan-" + common.GetRandomString(4),
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     "o" + common.GetRandomString(4),
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&orphan).Error)

	granted, err = SettleReferralLotteryTickets(DB, orphan.Id, step*2)
	require.NoError(t, err)
	require.Equal(t, 0, granted)

	var rewards int64
	require.NoError(t, DB.Model(&ReferralReward{}).
		Where("invitee_id IN ?", []int{selfInvite.Id, orphan.Id}).
		Count(&rewards).Error)
	require.Equal(t, int64(0), rewards)
}

// TestCreditTopUpQuotaWithLotterySettlesReferral 覆盖充值到账的完整链路。
//
// 充值到账与两笔赠送共用一个事务，这里确认「到账 + 充值赠送 + 邀请奖励」
// 三件事都真的落库了。
func TestCreditTopUpQuotaWithLotterySettlesReferral(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	inviter, invitee := seedReferralPair(t, 990351, 990352)
	step := operation_setting.GetCheckinTopUpStepQuota()

	require.NoError(t, creditTopUpQuotaWithLottery(DB, invitee.Id, step, map[string]any{}))

	inviteeAfter := User{}
	require.NoError(t, DB.Select("quota").First(&inviteeAfter, invitee.Id).Error)
	require.Equal(t, step, inviteeAfter.Quota, "充值必须到账")
	require.Equal(t, 3, bonusTicketsOf(t, invitee.Id), "被邀请人：充值赠送 1 次 + 邀请 2 次")
	require.Equal(t, 2, bonusTicketsOf(t, inviter.Id), "邀请人：基础 1 次 + 1 次")
}

// TestGetUserReferralInviteesMasksUsernames 覆盖邀请记录的用户名与结算状态。
//
// 邀请记录会展示给邀请人，用户名必须半隐藏，未结算的好友也要如实标出来。
func TestGetUserReferralInviteesMasksUsernames(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	inviter, invitee := seedReferralPair(t, 990361, 990362)
	step := operation_setting.GetCheckinTopUpStepQuota()

	invitees, err := GetUserReferralInvitees(inviter.Id, 50)
	require.NoError(t, err)
	require.Len(t, invitees, 1)
	require.False(t, invitees[0].Settled)
	require.Equal(t, MaskLotteryUsername(invitee.Username), invitees[0].Username)
	require.NotEqual(t, invitee.Username, invitees[0].Username)

	_, err = SettleReferralLotteryTickets(DB, invitee.Id, step)
	require.NoError(t, err)

	invitees, err = GetUserReferralInvitees(inviter.Id, 50)
	require.NoError(t, err)
	require.Len(t, invitees, 1)
	require.True(t, invitees[0].Settled)
	require.Equal(t, 2, invitees[0].Tickets)
	require.Equal(t, step, invitees[0].CreditedQuota)
	require.NotZero(t, invitees[0].SettledAt)

	tickets, err := GetUserReferralTickets(inviter.Id)
	require.NoError(t, err)
	require.Equal(t, 2, tickets)

	rewarded, err := GetUserReferralRewardedCount(inviter.Id)
	require.NoError(t, err)
	require.Equal(t, 1, rewarded)

	inviteeCount, err := GetUserInviteeCount(inviter.Id)
	require.NoError(t, err)
	require.Equal(t, 1, inviteeCount)
}

// TestCreditTopUpQuotaWithLotteryPaysReferralOnlyOnTheFirstTopUp 覆盖「仅限首次充值」。
//
// 同一被邀请人后续的每一笔充值都会再走一遍到账链路：他自己照常拿充值赠送，
// 但邀请奖励只在首充那一刻结算过一次，邀请人与被邀请人都不再重复发放。
func TestCreditTopUpQuotaWithLotteryPaysReferralOnlyOnTheFirstTopUp(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)

	inviter, invitee := seedReferralPair(t, 990391, 990392)
	step := operation_setting.GetCheckinTopUpStepQuota()
	require.Greater(t, step, 0)

	// 首充 5 元：不足一个档位，双方各得基础的 1 次
	require.NoError(t, creditTopUpQuotaWithLottery(DB, invitee.Id, step/2, map[string]any{}))
	require.Equal(t, 1, bonusTicketsOf(t, inviter.Id))
	require.Equal(t, 1, bonusTicketsOf(t, invitee.Id))

	// 第二笔 100 元：被邀请人只拿充值赠送的 10 次，邀请奖励不再结算
	require.NoError(t, creditTopUpQuotaWithLottery(DB, invitee.Id, step*10, map[string]any{}))
	require.Equal(t, 1, bonusTicketsOf(t, inviter.Id), "邀请人只在首充结算一次")
	require.Equal(t, 1+10, bonusTicketsOf(t, invitee.Id), "第二笔只有充值赠送")

	// 第三笔 10 元：同样只加充值赠送的 1 次
	require.NoError(t, creditTopUpQuotaWithLottery(DB, invitee.Id, step, map[string]any{}))
	require.Equal(t, 1, bonusTicketsOf(t, inviter.Id))
	require.Equal(t, 1+10+1, bonusTicketsOf(t, invitee.Id))

	var rewards []ReferralReward
	require.NoError(t, DB.Where("invitee_id = ?", invitee.Id).Find(&rewards).Error)
	require.Len(t, rewards, 1, "一位被邀请人只有一条结算记录")
	require.Equal(t, inviter.Id, rewards[0].InviterId)
	require.Equal(t, step/2, rewards[0].CreditedQuota, "结算记录停在首充的到账额度")

	require.Equal(t, 1, referralLedgerOf(t, inviter.Id))
	require.Equal(t, 1, referralLedgerOf(t, invitee.Id))
}

// TestRedeemCodeDoesNotSettleReferralTickets 兑换码不是充值，不结算邀请奖励。
//
// 兑换码只增加额度（走 creditTopUpQuota），因此被邀请人先兑换、后真实充值，
// 那份「首次充值」的邀请奖励依然留给他真正付费的那一笔。
func TestRedeemCodeDoesNotSettleReferralTickets(t *testing.T) {
	migrateReferralTables(t)
	withTopUpStep(t, 10)
	withReferralBaseTickets(t, 1)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))

	inviter, invitee := seedReferralPair(t, 990381, 990382)
	step := operation_setting.GetCheckinTopUpStepQuota()

	key := "hohai-referral-" + common.GetRandomString(8)
	redemption := Redemption{
		Name:        "referral-redeem",
		Key:         key,
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       step * 3,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&redemption).Error)

	credited, err := Redeem(key, invitee.Id)
	require.NoError(t, err)
	require.Equal(t, step*3, credited)

	require.Zero(t, bonusTicketsOf(t, invitee.Id), "兑换码不发抽奖次数")
	require.Zero(t, bonusTicketsOf(t, inviter.Id), "兑换码不结算邀请奖励")

	var rewards int64
	require.NoError(t, DB.Model(&ReferralReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Zero(t, rewards)

	// 之后的首次真实充值照常结算：被邀请人 1 次充值赠送 + 2 次邀请奖励
	require.NoError(t, creditTopUpQuotaWithLottery(DB, invitee.Id, step, map[string]any{}))
	require.Equal(t, 2, bonusTicketsOf(t, inviter.Id))
	require.Equal(t, 3, bonusTicketsOf(t, invitee.Id))
}
