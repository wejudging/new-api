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

// defaultPrizeSetting 默认奖池配置：¥0.01 ~ ¥1.00，12 档，单次期望 ¥0.10
func defaultPrizeSetting() CheckinSetting {
	return CheckinSetting{
		Enabled:        true,
		DailyDraws:     1,
		PrizeMinAmount: DefaultCheckinPrizeMinAmount,
		PrizeMaxAmount: DefaultCheckinPrizeMaxAmount,
		PrizeExpected:  DefaultCheckinPrizeExpectedAmount,
		PrizeTiers:     DefaultCheckinPrizeTiers,
	}
}

func TestDefaultCheckinPrizePoolPaysAboutThreeYuanPerMonth(t *testing.T) {
	withCheckinSetting(t, defaultPrizeSetting())

	prizes := GetCheckinPrizes()
	require.Len(t, prizes, 12)
	require.Equal(t, 0.01, prizes[0].Amount)
	require.Equal(t, 1.0, prizes[len(prizes)-1].Amount)

	expected := GetCheckinPrizeExpectedAmount()
	require.InDelta(t, DefaultCheckinPrizeExpectedAmount, expected, 0.0005)

	monthly := expected * float64(GetCheckinDailyDraws()) * 30
	require.InDelta(t, 3.0, monthly, 0.02)
}

func TestCheckinPrizeLadderRaisesAmountAndLowersChance(t *testing.T) {
	withCheckinSetting(t, defaultPrizeSetting())

	prizes := GetCheckinPrizes()
	for i := 1; i < len(prizes); i++ {
		require.Greater(t, prizes[i].Amount, prizes[i-1].Amount, "金额必须严格递增")
		require.Greater(t, prizes[i-1].Weight, prizes[i].Weight, "金额越高权重越小")
	}
	require.GreaterOrEqual(t, prizes[len(prizes)-1].Weight, 1, "最高档必须抽得到")
}

func TestCheckinPrizePoolFollowsTheConfiguredRange(t *testing.T) {
	withCheckinSetting(t, CheckinSetting{
		PrizeMinAmount: 0.02,
		PrizeMaxAmount: 2,
		PrizeExpected:  0.2,
		PrizeTiers:     8,
	})

	prizes := GetCheckinPrizes()
	require.Len(t, prizes, 8)
	require.Equal(t, 0.02, prizes[0].Amount)
	require.Equal(t, 2.0, prizes[len(prizes)-1].Amount)
	require.InDelta(t, 0.2, GetCheckinPrizeExpectedAmount(), 0.0005)
}

func TestCheckinPrizeTiersCollapseWhenTheRangeIsTiny(t *testing.T) {
	withCheckinSetting(t, CheckinSetting{
		PrizeMinAmount: 0.01,
		PrizeMaxAmount: 0.05,
		PrizeExpected:  0.02,
		PrizeTiers:     12,
	})

	prizes := GetCheckinPrizes()
	require.Len(t, prizes, 5, "¥0.01~¥0.05 只放得下 5 个不重复档位")
	require.Equal(t, 0.01, prizes[0].Amount)
	require.Equal(t, 0.05, prizes[len(prizes)-1].Amount)
}

func TestCheckinPrizeExpectationIsClampedToThePool(t *testing.T) {
	// 期望低于最低档 → 收敛到最低档金额
	withCheckinSetting(t, CheckinSetting{
		PrizeMinAmount: 0.01,
		PrizeMaxAmount: 1,
		PrizeExpected:  0.001,
		PrizeTiers:     4,
	})
	require.InDelta(t, 0.01, GetCheckinPrizeExpectedAmount(), 0.0005)

	// 期望高于各档均值（无解） → 收敛到均值
	withCheckinSetting(t, CheckinSetting{
		PrizeMinAmount: 0.1,
		PrizeMaxAmount: 1,
		PrizeExpected:  100,
		PrizeTiers:     4,
	})
	prizes := GetCheckinPrizes()
	mean := 0.0
	for _, prize := range prizes {
		mean += prize.Amount
	}
	mean /= float64(len(prizes))
	require.InDelta(t, mean, GetCheckinPrizeExpectedAmount(), 0.0005)
}

func TestPickCheckinPrizeStaysInsideTheConfiguredPool(t *testing.T) {
	withCheckinSetting(t, CheckinSetting{
		Enabled:        true,
		DailyDraws:     1,
		PrizeMinAmount: 0.05,
		PrizeMaxAmount: 0.5,
		PrizeExpected:  0.1,
		PrizeTiers:     2,
	})

	seen := map[float64]int{}
	for range 1000 {
		prize, err := PickCheckinPrize()
		require.NoError(t, err)
		require.Contains(t, []float64{0.05, 0.5}, prize.Amount)
		seen[prize.Amount]++
	}

	require.Len(t, seen, 2)
	require.Greater(t, seen[0.05], seen[0.5], "低档位应该更常见")
}

func TestCheckinPrizesFallBackToDefaultsWhenUnset(t *testing.T) {
	withCheckinSetting(t, CheckinSetting{Enabled: true, DailyDraws: 1})

	prizes := GetCheckinPrizes()
	require.Len(t, prizes, DefaultCheckinPrizeTiers)
	require.Equal(t, DefaultCheckinPrizeMinAmount, prizes[0].Amount)
	require.Equal(t, DefaultCheckinPrizeMaxAmount, prizes[len(prizes)-1].Amount)
	require.InDelta(t, DefaultCheckinPrizeExpectedAmount, GetCheckinPrizeExpectedAmount(), 0.0005)
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
	// 赠送只受门槛控制：即使签到抽奖暂时关闭，门槛换算依然生效
	withCheckinSetting(t, CheckinSetting{
		Enabled:          false,
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
		Enabled:          false,
		DailyDraws:       1,
		TopUpYuanPerDraw: 0,
	})

	require.Equal(t, 0, GetCheckinTopUpStepQuota())

	granted, remainder := SplitCheckinTopUpTickets(1234, CheckinPrizeQuota(100))
	require.Equal(t, 0, granted)
	require.Equal(t, int64(1234), remainder)
}
