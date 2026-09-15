package operation_setting

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

// withCheckinSetting 在测试期间替换签到配置，结束后恢复
func withCheckinSetting(t *testing.T, setting CheckinSetting) {
	t.Helper()
	original := checkinSetting
	checkinSetting = setting
	t.Cleanup(func() {
		checkinSetting = original
	})
}

func TestDefaultCheckinPrizesPayAboutThreeYuanPerMonth(t *testing.T) {
	withCheckinSetting(t, CheckinSetting{
		Enabled:    true,
		DailyDraws: 1,
		Prizes:     DefaultCheckinPrizes,
	})

	require.Equal(t, 100, GetCheckinPrizeWeights())

	expected := GetCheckinPrizeExpectedAmount()
	require.InDelta(t, 0.102, expected, 0.0005)

	monthly := expected * float64(GetCheckinDailyDraws()) * 30
	require.InDelta(t, 3.06, monthly, 0.02)
}

func TestPickCheckinPrizeStaysInsideTheConfiguredPool(t *testing.T) {
	withCheckinSetting(t, CheckinSetting{
		Enabled:    true,
		DailyDraws: 1,
		Prizes: []CheckinPrize{
			{Amount: 0.05, Weight: 1},
			{Amount: 0.5, Weight: 1},
		},
	})

	seen := map[float64]int{}
	for range 1000 {
		prize, err := PickCheckinPrize()
		require.NoError(t, err)
		require.Contains(t, []float64{0.05, 0.5}, prize.Amount)
		seen[prize.Amount]++
	}

	require.Len(t, seen, 2)
}

func TestCheckinPrizesFallBackToDefaultsWhenUnset(t *testing.T) {
	withCheckinSetting(t, CheckinSetting{Enabled: true, DailyDraws: 1})

	require.Equal(t, DefaultCheckinPrizes, GetCheckinPrizes())
	require.Equal(t, 100, GetCheckinPrizeWeights())
}

func TestCheckinPrizeQuotaFollowsTheExchangeRate(t *testing.T) {
	originalRate := USDExchangeRate
	t.Cleanup(func() {
		USDExchangeRate = originalRate
	})

	USDExchangeRate = 1
	require.Equal(t, int(math.Round(0.5*common.QuotaPerUnit)), CheckinPrizeQuota(0.5))

	USDExchangeRate = 7.3
	require.Equal(
		t,
		int(math.Round(0.1/7.3*common.QuotaPerUnit)),
		CheckinPrizeQuota(0.1),
	)
}

func TestCheckinPrizeQuotaNeverDropsBelowOne(t *testing.T) {
	originalRate := USDExchangeRate
	t.Cleanup(func() {
		USDExchangeRate = originalRate
	})

	USDExchangeRate = 100000
	require.Equal(t, 1, CheckinPrizeQuota(0.05))
}

// stubQuotaUnits 固定汇率与额度单位，让充值赠送的换算结果可预期
func stubQuotaUnits(t *testing.T) {
	t.Helper()
	originalRate := USDExchangeRate
	originalQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		USDExchangeRate = originalRate
		common.QuotaPerUnit = originalQuotaPerUnit
	})
	USDExchangeRate = 1
	common.QuotaPerUnit = 500000
}

func TestCheckinTopUpTicketsUseTheCreditedAmount(t *testing.T) {
	stubQuotaUnits(t)
	withCheckinSetting(t, CheckinSetting{
		Enabled:          true,
		DailyDraws:       1,
		TopUpYuanPerDraw: 10,
	})

	step := GetCheckinTopUpStepQuota()
	require.Equal(t, CheckinPrizeQuota(10), step)
	require.Equal(t, 5000000, step)

	// 到账 10 元即赠送 1 次
	granted, remainder := SplitCheckinTopUpTickets(0, CheckinPrizeQuota(10))
	require.Equal(t, 1, granted)
	require.Equal(t, int64(0), remainder)

	// 支付 9.9 元但按到账 10 元计算，减免部分不影响赠送
	granted, remainder = SplitCheckinTopUpTickets(0, CheckinPrizeQuota(9.9))
	require.Equal(t, 0, granted)
	require.Equal(t, int64(CheckinPrizeQuota(9.9)), remainder)

	granted, remainder = SplitCheckinTopUpTickets(remainder, CheckinPrizeQuota(10)-CheckinPrizeQuota(9.9))
	require.Equal(t, 1, granted)
	require.Equal(t, int64(0), remainder)
}

func TestCheckinTopUpTicketsAccumulateAcrossOrders(t *testing.T) {
	stubQuotaUnits(t)
	withCheckinSetting(t, CheckinSetting{
		Enabled:          true,
		DailyDraws:       1,
		TopUpYuanPerDraw: 10,
	})

	// 单笔 20 元 → 2 次
	granted, remainder := SplitCheckinTopUpTickets(0, CheckinPrizeQuota(20))
	require.Equal(t, 2, granted)
	require.Equal(t, int64(0), remainder)

	// 5 元 + 5 元 → 1 次，余量跨订单累计
	granted, remainder = SplitCheckinTopUpTickets(0, CheckinPrizeQuota(5))
	require.Equal(t, 0, granted)
	granted, remainder = SplitCheckinTopUpTickets(remainder, CheckinPrizeQuota(5))
	require.Equal(t, 1, granted)
	require.Equal(t, int64(0), remainder)
}

func TestCheckinTopUpTicketsStayOffWhenDisabled(t *testing.T) {
	stubQuotaUnits(t)
	withCheckinSetting(t, CheckinSetting{
		Enabled:          true,
		DailyDraws:       1,
		TopUpYuanPerDraw: 0,
	})

	require.Equal(t, 0, GetCheckinTopUpStepQuota())

	granted, remainder := SplitCheckinTopUpTickets(1234, CheckinPrizeQuota(100))
	require.Equal(t, 0, granted)
	require.Equal(t, int64(1234), remainder)
}
