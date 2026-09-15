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
