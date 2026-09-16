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

// TestSettleReferralLotteryTicketsPaysBothSidesOnASmallFirstTopUp 覆盖小额首充的保底奖励。
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

	// 首充 5 元：充值赠送拿不到次数，保底双方各 1 次
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
// 到账 25 元时双方各得 2 次；这份邀请次数是被邀请人的独立权益，
// 不会抵扣掉他本来就有的充值赠送次数（首充那一笔两份都拿，仅限首次）。
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
	require.Equal(t, 2, granted, "25 元首充双方各得 2 次")

	require.Equal(t, 2, bonusTicketsOf(t, inviter.Id))
	require.Equal(t, 4, bonusTicketsOf(t, invitee.Id), "被邀请人两份都拿：充值赠送 + 邀请次数")
	require.Equal(t, 2, referralLedgerOf(t, invitee.Id), "被邀请人也要留下邀请流水")

	var reward ReferralReward
	require.NoError(t, DB.Where("invitee_id = ?", invitee.Id).First(&reward).Error)
	require.Equal(t, 2, reward.Tickets)
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
			require.Equal(t, 1, granted)
			continue
		}
		require.Equal(t, 0, granted, "重复结算必须直接跳过")
	}

	var rewards int64
	require.NoError(t, DB.Model(&ReferralReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Equal(t, int64(1), rewards)
	require.Equal(t, 1, bonusTicketsOf(t, inviter.Id))
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
	require.Equal(t, 2, sum, "并发回调也只允许发一次奖")
	require.Equal(t, 2, bonusTicketsOf(t, inviter.Id))

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
	require.Equal(t, 2, bonusTicketsOf(t, invitee.Id), "被邀请人：充值赠送 1 次 + 邀请 1 次")
	require.Equal(t, 1, bonusTicketsOf(t, inviter.Id))
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
	require.Equal(t, 1, invitees[0].Tickets)
	require.Equal(t, step, invitees[0].CreditedQuota)
	require.NotZero(t, invitees[0].SettledAt)

	tickets, err := GetUserReferralTickets(inviter.Id)
	require.NoError(t, err)
	require.Equal(t, 1, tickets)

	rewarded, err := GetUserReferralRewardedCount(inviter.Id)
	require.NoError(t, err)
	require.Equal(t, 1, rewarded)

	inviteeCount, err := GetUserInviteeCount(inviter.Id)
	require.NoError(t, err)
	require.Equal(t, 1, inviteeCount)
}
