package operation_setting

import (
	"errors"
	"math"
	"math/rand"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// CheckinPrize 签到抽奖奖池档位
type CheckinPrize struct {
	Amount float64 `json:"amount"` // 奖品金额（人民币元）
	Weight int     `json:"weight"` // 权重，越大中奖概率越高
}

// CheckinSetting 签到抽奖功能配置
type CheckinSetting struct {
	Enabled          bool    `json:"enabled"`               // 是否启用签到功能
	MinQuota         int     `json:"min_quota"`             // 旧版随机签到额度下限（保留兼容）
	MaxQuota         int     `json:"max_quota"`             // 旧版随机签到额度上限（保留兼容）
	DailyDraws       int     `json:"daily_draws"`           // 每日可领取的抽奖次数
	TopUpYuanPerDraw float64 `json:"topup_yuan_per_draw"`   // 累计充值满多少元赠送 1 次抽奖，<=0 表示不赠送
	PrizeMinAmount   float64 `json:"prize_min_amount"`      // 奖池最低金额（人民币元）
	PrizeMaxAmount   float64 `json:"prize_max_amount"`      // 奖池最高金额（人民币元）
	PrizeExpected    float64 `json:"prize_expected_amount"` // 单次抽奖期望金额（人民币元），档位权重由此反推
	PrizeTiers       int     `json:"prize_tiers"`           // 奖池档位数量（前台按 4 列铺开，默认 12 档 = 4×3）
}

const (
	// DefaultCheckinPrizeMinAmount 默认奖池最低金额
	DefaultCheckinPrizeMinAmount = 0.01
	// DefaultCheckinPrizeMaxAmount 默认奖池最高金额
	DefaultCheckinPrizeMaxAmount = 1.0
	// DefaultCheckinPrizeExpectedAmount 默认单次期望金额（每日 1 次约合每月 ¥3）
	DefaultCheckinPrizeExpectedAmount = 0.1
	// DefaultCheckinPrizeTiers 默认档位数量（4 列 × 3 行）
	DefaultCheckinPrizeTiers = 12
	// MaxCheckinPrizeTiers 档位数量上限
	MaxCheckinPrizeTiers = 30

	// checkinPrizeAmountStep 金额最小步长，奖池金额按分取整
	checkinPrizeAmountStep = 0.01
	// checkinPrizeWeightTotal 权重总和，权重取整后的精度
	checkinPrizeWeightTotal = 100000
)

// 默认配置
var checkinSetting = CheckinSetting{
	Enabled:          false,                             // 默认关闭
	MinQuota:         1000,                              // 默认最小额度 1000 (约 0.002 USD)
	MaxQuota:         10000,                             // 默认最大额度 10000 (约 0.02 USD)
	DailyDraws:       1,                                 // 默认每日 1 次抽奖
	TopUpYuanPerDraw: 10,                                // 默认每累计充值 10 元赠送 1 次抽奖
	PrizeMinAmount:   DefaultCheckinPrizeMinAmount,      // 默认最低 ¥0.01
	PrizeMaxAmount:   DefaultCheckinPrizeMaxAmount,      // 默认最高 ¥1.00
	PrizeExpected:    DefaultCheckinPrizeExpectedAmount, // 默认单次期望 ¥0.10
	PrizeTiers:       DefaultCheckinPrizeTiers,          // 默认 12 档
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("checkin_setting", &checkinSetting)
}

// GetCheckinSetting 获取签到配置
func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}

// IsCheckinEnabled 是否启用签到功能
func IsCheckinEnabled() bool {
	return checkinSetting.Enabled
}

// GetCheckinQuotaRange 获取签到额度范围
func GetCheckinQuotaRange() (min, max int) {
	return checkinSetting.MinQuota, checkinSetting.MaxQuota
}

// GetCheckinDailyDraws 获取每日可领取的抽奖次数
func GetCheckinDailyDraws() int {
	if checkinSetting.DailyDraws <= 0 {
		return 1
	}
	return checkinSetting.DailyDraws
}

// roundToCents 按分取整，避免浮点误差出现在奖池金额里
func roundToCents(amount float64) float64 {
	return math.Round(amount*100) / 100
}

// GetCheckinPrizeAmountRange 获取奖池金额范围（元），已按分对齐
func GetCheckinPrizeAmountRange() (minAmount, maxAmount float64) {
	minAmount = roundToCents(checkinSetting.PrizeMinAmount)
	if minAmount < DefaultCheckinPrizeMinAmount {
		minAmount = DefaultCheckinPrizeMinAmount
	}
	maxAmount = roundToCents(checkinSetting.PrizeMaxAmount)
	if maxAmount <= 0 {
		maxAmount = DefaultCheckinPrizeMaxAmount
	}
	if maxAmount < minAmount {
		maxAmount = minAmount
	}
	return minAmount, maxAmount
}

// GetCheckinPrizeTargetAmount 获取配置的单次抽奖期望金额（元）
func GetCheckinPrizeTargetAmount() float64 {
	target := checkinSetting.PrizeExpected
	if target <= 0 {
		target = DefaultCheckinPrizeExpectedAmount
	}
	lowest, _ := GetCheckinPrizeAmountRange()
	if target < lowest {
		target = lowest
	}
	return target
}

// GetCheckinPrizeTierCount 获取奖池档位数量
//
// 档位数量会按金额范围收敛，范围太窄时不会生成重复金额的档位。
func GetCheckinPrizeTierCount() int {
	minAmount, maxAmount := GetCheckinPrizeAmountRange()
	tiers := checkinSetting.PrizeTiers
	if tiers <= 0 {
		tiers = DefaultCheckinPrizeTiers
	}
	if tiers > MaxCheckinPrizeTiers {
		tiers = MaxCheckinPrizeTiers
	}
	room := int(math.Round((maxAmount-minAmount)/checkinPrizeAmountStep)) + 1
	if tiers > room {
		tiers = room
	}
	if tiers < 1 {
		tiers = 1
	}
	return tiers
}

// buildCheckinPrizeAmounts 在金额范围内生成等比递增的档位金额
func buildCheckinPrizeAmounts(minAmount, maxAmount float64, tiers int) []float64 {
	amounts := make([]float64, 0, tiers)
	if tiers <= 1 {
		return append(amounts, roundToCents(minAmount))
	}
	ratio := math.Pow(maxAmount/minAmount, 1/float64(tiers-1))
	for i := 0; i < tiers; i++ {
		amount := roundToCents(minAmount * math.Pow(ratio, float64(i)))
		if i == tiers-1 {
			amount = roundToCents(maxAmount)
		}
		if i > 0 && amount <= amounts[i-1] {
			amount = roundToCents(amounts[i-1] + checkinPrizeAmountStep)
		}
		amounts = append(amounts, amount)
	}
	return amounts
}

// checkinPrizeDecayExpected 指数衰减权重下奖池的单次期望金额
func checkinPrizeDecayExpected(amounts []float64, decay float64) float64 {
	weightSum := 0.0
	amountSum := 0.0
	for i, amount := range amounts {
		weight := math.Exp(-decay * float64(i))
		weightSum += weight
		amountSum += amount * weight
	}
	if weightSum <= 0 {
		return 0
	}
	return amountSum / weightSum
}

// buildCheckinPrizeWeights 反推各档位权重，让单次期望等于目标金额
//
// 权重按档位指数衰减，衰减系数用二分法求解：金额越高权重越小，最高档最稀有。
// 期望的可行区间是「最低档金额 ~ 各档均值」，超出区间时收敛到区间边界。
func buildCheckinPrizeWeights(amounts []float64, target float64) []int {
	count := len(amounts)
	weights := make([]int, count)
	if count == 0 {
		return weights
	}
	if count == 1 {
		weights[0] = checkinPrizeWeightTotal
		return weights
	}

	mean := 0.0
	for _, amount := range amounts {
		mean += amount
	}
	mean /= float64(count)
	lowest := amounts[0]
	if target > mean {
		target = mean
	}
	if target < lowest {
		target = lowest
	}

	decay := 0.0
	if target < mean {
		low, high := 0.0, 64.0
		for i := 0; i < 60; i++ {
			mid := (low + high) / 2
			if checkinPrizeDecayExpected(amounts, mid) > target {
				low = mid
			} else {
				high = mid
			}
		}
		decay = (low + high) / 2
	}

	rawSum := 0.0
	for i := range amounts {
		rawSum += math.Exp(-decay * float64(i))
	}
	total := 0
	for i := range amounts {
		weight := int(math.Round(math.Exp(-decay*float64(i)) / rawSum * checkinPrizeWeightTotal))
		if weight < 1 {
			weight = 1
		}
		weights[i] = weight
		total += weight
	}

	// 取整会带来偏差，用最高档的权重补齐，保证期望与配置一致
	if amount := amounts[count-1]; amount > 0 {
		current := 0.0
		for i := range amounts {
			current += amounts[i] * float64(weights[i])
		}
		delta := int(math.Round((target*float64(total) - current) / amount))
		if weights[count-1]+delta < 1 {
			delta = 1 - weights[count-1]
		}
		weights[count-1] += delta
	}
	return weights
}

// GetCheckinPrizes 获取生效的奖池
//
// 奖池由「金额范围 + 单次期望 + 档位数量」自动生成：金额在范围内等比递增铺开，
// 权重按指数衰减反推，使单次期望等于配置值。
func GetCheckinPrizes() []CheckinPrize {
	minAmount, maxAmount := GetCheckinPrizeAmountRange()
	tiers := GetCheckinPrizeTierCount()
	amounts := buildCheckinPrizeAmounts(minAmount, maxAmount, tiers)
	weights := buildCheckinPrizeWeights(amounts, GetCheckinPrizeTargetAmount())
	prizes := make([]CheckinPrize, 0, len(amounts))
	for i, amount := range amounts {
		prizes = append(prizes, CheckinPrize{Amount: amount, Weight: weights[i]})
	}
	return prizes
}

// GetCheckinTopUpYuanPerDraw 累计充值赠送抽奖的门槛金额（元）；<=0 表示关闭该赠送
func GetCheckinTopUpYuanPerDraw() float64 {
	return checkinSetting.TopUpYuanPerDraw
}

// GetCheckinTopUpStepQuota 充值赠送门槛对应的系统额度；<=0 表示关闭该赠送
//
// 门槛按「到账金额」计算，因此充值减免（付 9.9 元到账 10 元）同样能拿到赠送。
func GetCheckinTopUpStepQuota() int {
	yuan := GetCheckinTopUpYuanPerDraw()
	if yuan <= 0 {
		return 0
	}
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return CheckinPrizeQuota(yuan)
}

// SplitCheckinTopUpTickets 按累计到账额度计算本次赠送的抽奖次数与剩余余量
//
// 余量会跨订单累计，因此「5 元 + 5 元」与「一次 10 元」都能拿到 1 次赠送。
func SplitCheckinTopUpTickets(remainderQuota int64, creditedQuota int) (granted int, nextRemainder int64) {
	step := int64(GetCheckinTopUpStepQuota())
	if step <= 0 || creditedQuota <= 0 {
		return 0, remainderQuota
	}
	total := remainderQuota + int64(creditedQuota)
	return int(total / step), total % step
}

// GetCheckinPrizeWeights 获取奖池总权重
func GetCheckinPrizeWeights() int {
	total := 0
	for _, prize := range GetCheckinPrizes() {
		total += prize.Weight
	}
	return total
}

// PickCheckinPrize 按权重随机抽取一个奖品
func PickCheckinPrize() (CheckinPrize, error) {
	prizes := GetCheckinPrizes()
	total := GetCheckinPrizeWeights()
	if len(prizes) == 0 || total <= 0 {
		return CheckinPrize{}, errors.New("签到奖池未配置")
	}
	roll := rand.Intn(total)
	for _, prize := range prizes {
		if roll < prize.Weight {
			return prize, nil
		}
		roll -= prize.Weight
	}
	return prizes[len(prizes)-1], nil
}

// GetCheckinPrizeExpectedAmount 奖池单次抽奖的期望金额（人民币元）
func GetCheckinPrizeExpectedAmount() float64 {
	prizes := GetCheckinPrizes()
	total := GetCheckinPrizeWeights()
	if len(prizes) == 0 || total <= 0 {
		return 0
	}
	expected := 0.0
	for _, prize := range prizes {
		expected += prize.Amount * float64(prize.Weight)
	}
	return expected / float64(total)
}

// CheckinPrizeQuota 将奖品金额（人民币元）换算为系统额度
func CheckinPrizeQuota(amount float64) int {
	rate := USDExchangeRate
	if rate <= 0 {
		rate = 1
	}
	quota := int(math.Round(amount / rate * common.QuotaPerUnit))
	if quota < 1 {
		quota = 1
	}
	return quota
}
