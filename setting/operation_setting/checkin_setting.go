package operation_setting

import (
	"errors"
	"fmt"
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
	RequireTopUp     bool    `json:"require_topup"`         // 是否仅限有过成功充值记录的用户参与
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
	// checkinPrizeGapJitterMin / Max 相邻档位间距的扰动倍数区间（对数均匀）
	//
	// 基准间距来自等比数列，乘上这个区间的随机倍数再归一化回总跨度后，档位金额就会
	// 错落开，不再是一眼看得出的等差/等比数列。区间不能太宽，否则会出现一大一小
	// 交替的锯齿感。
	checkinPrizeGapJitterMin = 0.4
	checkinPrizeGapJitterMax = 2.5
	// checkinPrizeBandLow / High 扰动后的档位金额相对等比基准的偏移限制
	//
	// 只靠间距扰动有可能把某一档推得太高或太低，用这个区间把金额圈在基准附近，
	// 奖池整体仍是「低档密集、高档稀疏」的形状。
	checkinPrizeBandLow  = 0.6
	checkinPrizeBandHigh = 1.7
	// checkinPrizeJitterSalt 奖池扰动的盐值，只用来挑选一条固定的扰动量
	//
	// 换掉它会得到另一套金额，但档位数量、金额范围与单次期望都不受影响。
	checkinPrizeJitterSalt = "hohai-lottery-mix"
)

// 默认配置
var checkinSetting = CheckinSetting{
	Enabled:          false,                             // 默认关闭
	RequireTopUp:     true,                              // 默认仅限有过充值记录的用户参与，抵御批量注册
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

// IsCheckinTopUpRequired 是否仅限有过成功充值记录的用户参与签到抽奖
//
// 该门槛用于拦住批量注册的小号：新账号不充值就只能看到提示，不能签到抽奖。
func IsCheckinTopUpRequired() bool {
	return checkinSetting.RequireTopUp
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

// checkinPrizeRandom 奖池专用的确定性伪随机数发生器（splitmix64）
//
// 档位金额既要在前端展示、又要在抽奖时结算，两处必须完全一致，所以这里不能用
// math/rand 的全局源（它带时间种子），也不能依赖任何外部状态：发生器只由配置驱动，
// 同一套配置在任何机器、任何时间都生成同一份奖池。
type checkinPrizeRandom struct {
	state uint64
}

func newCheckinPrizeRandom(seed uint64) *checkinPrizeRandom {
	if seed == 0 {
		seed = 0x9E3779B97F4A7C15
	}
	return &checkinPrizeRandom{state: seed}
}

func (random *checkinPrizeRandom) next() uint64 {
	random.state += 0x9E3779B97F4A7C15
	value := random.state
	value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9
	value = (value ^ (value >> 27)) * 0x94D049BB133111EB
	return value ^ (value >> 31)
}

// nextFloat 返回 [0, 1) 区间的浮点数
func (random *checkinPrizeRandom) nextFloat() float64 {
	return float64(random.next()>>11) / float64(uint64(1)<<53)
}

// checkinPrizeSeed 由金额范围与档位数量推导奖池种子（FNV-1a）
func checkinPrizeSeed(minAmount, maxAmount float64, tiers int) uint64 {
	key := fmt.Sprintf("%.2f|%.2f|%d|%s", minAmount, maxAmount, tiers, checkinPrizeJitterSalt)
	hash := uint64(0xcbf29ce484222325)
	for i := 0; i < len(key); i++ {
		hash ^= uint64(key[i])
		hash *= 0x100000001b3
	}
	return hash
}

// checkinPrizeJitterFactor 返回一个对数均匀的间距扰动倍数
func checkinPrizeJitterFactor(random *checkinPrizeRandom) float64 {
	lowest := math.Log(checkinPrizeGapJitterMin)
	highest := math.Log(checkinPrizeGapJitterMax)
	return math.Exp(lowest + random.nextFloat()*(highest-lowest))
}

// buildCheckinPrizeAmounts 生成奖池的档位金额
//
// 首档固定是最低金额、末档固定是最高金额，中间档位在等比基准上做确定性扰动：相邻
// 间距乘上 0.4~2.5 倍的随机倍数后重新归一化回总跨度，金额因此错落有致，不再是能
// 一眼看穿的等差/等比数列。生成结果始终满足：
//   - 按分对齐、严格递增，相邻档位至少相差 ¥0.01
//   - 首尾金额等于配置的最低/最高金额，总跨度一分不差
//   - 同一套配置永远生成同一份奖池，卡片上展示的金额就是结算的金额
func buildCheckinPrizeAmounts(minAmount, maxAmount float64, tiers int) []float64 {
	minAmount = roundToCents(minAmount)
	maxAmount = roundToCents(maxAmount)
	if tiers <= 1 || maxAmount <= minAmount {
		return []float64{minAmount}
	}
	spanCents := int(math.Round((maxAmount - minAmount) / checkinPrizeAmountStep))
	if spanCents < 1 {
		return []float64{minAmount}
	}
	if room := spanCents + 1; tiers > room {
		tiers = room
	}

	// 等比基准：第 i 档相对最低金额的偏移（单位：分）
	// 它既是扰动的锚点，也是形状的约束线，保证奖池整体仍是「低档密集、高档稀疏」
	ratio := math.Pow(maxAmount/minAmount, 1/float64(tiers-1))
	baseCents := make([]float64, tiers)
	for i := range baseCents {
		baseCents[i] = (minAmount*math.Pow(ratio, float64(i)) - minAmount) / checkinPrizeAmountStep
	}
	baseCents[0] = 0
	baseCents[tiers-1] = float64(spanCents)

	random := newCheckinPrizeRandom(checkinPrizeSeed(minAmount, maxAmount, tiers))
	gaps := make([]int, tiers-1)
	scaled := make([]float64, len(gaps))
	scaledTotal := 0.0
	for i := range scaled {
		scaled[i] = (baseCents[i+1] - baseCents[i]) * checkinPrizeJitterFactor(random)
		scaledTotal += scaled[i]
	}
	total := 0
	for i, value := range scaled {
		gap := int(math.Round(value / scaledTotal * float64(spanCents)))
		if gap < 1 {
			gap = 1
		}
		gaps[i] = gap
		total += gap
	}
	// 取整偏差逐步摊到当前最宽的间距上，保证间距之和精确等于总跨度
	//
	// total 必须跟着一起走：只看初始偏差的话，差额永远补不平，循环会一直转下去。
	for {
		drift := spanCents - total
		if drift == 0 {
			break
		}
		widest := 0
		for i, gap := range gaps {
			if gap > gaps[widest] {
				widest = i
			}
		}
		if drift < 0 {
			if gaps[widest] <= 1 {
				break
			}
			gaps[widest]--
			total--
			continue
		}
		gaps[widest]++
		total++
	}

	amounts := make([]float64, 0, tiers)
	amounts = append(amounts, minAmount)
	cursor := 0
	placed := 0
	for i := 1; i < tiers-1; i++ {
		cursor += gaps[i-1]
		offset := math.Min(float64(cursor), math.Floor(checkinPrizeBandHigh*baseCents[i]))
		offset = math.Max(offset, math.Ceil(checkinPrizeBandLow*baseCents[i]))
		if lowest := float64(placed + 1); offset < lowest {
			offset = lowest
		}
		if highest := float64(spanCents - (tiers - 1 - i)); offset > highest {
			offset = highest
		}
		placed = int(offset)
		amounts = append(amounts, roundToCents(minAmount+offset*checkinPrizeAmountStep))
	}
	return append(amounts, maxAmount)
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
// 奖池由「金额范围 + 单次期望 + 档位数量」自动生成：金额在范围内错落铺开（首尾金额
// 固定，中间档位带确定性扰动），权重按指数衰减反推，使单次期望等于配置值。
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
