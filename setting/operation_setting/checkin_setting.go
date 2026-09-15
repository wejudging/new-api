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
	Enabled          bool           `json:"enabled"`             // 是否启用签到功能
	MinQuota         int            `json:"min_quota"`           // 旧版随机签到额度下限（保留兼容）
	MaxQuota         int            `json:"max_quota"`           // 旧版随机签到额度上限（保留兼容）
	DailyDraws       int            `json:"daily_draws"`         // 每日可领取的抽奖次数
	TopUpYuanPerDraw float64        `json:"topup_yuan_per_draw"` // 累计充值满多少元赠送 1 次抽奖，<=0 表示不赠送
	Prizes           []CheckinPrize `json:"prizes"`              // 奖池配置，金额单位为人民币元
}

// DefaultCheckinPrizes 默认奖池
//
// 单次期望 ¥0.102，按每日 1 次抽奖计算，连续签到 30 天约 ¥3.06。
var DefaultCheckinPrizes = []CheckinPrize{
	{Amount: 0.05, Weight: 40}, // 40%
	{Amount: 0.08, Weight: 25}, // 25%
	{Amount: 0.10, Weight: 15}, // 15%
	{Amount: 0.15, Weight: 10}, // 10%
	{Amount: 0.20, Weight: 6},  // 6%
	{Amount: 0.50, Weight: 4},  // 4%
}

// 默认配置
var checkinSetting = CheckinSetting{
	Enabled:          false, // 默认关闭
	MinQuota:         1000,  // 默认最小额度 1000 (约 0.002 USD)
	MaxQuota:         10000, // 默认最大额度 10000 (约 0.02 USD)
	DailyDraws:       1,     // 默认每日 1 次抽奖
	TopUpYuanPerDraw: 10,    // 默认每累计充值 10 元赠送 1 次抽奖
	Prizes:           DefaultCheckinPrizes,
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

// GetCheckinPrizes 获取生效的奖池（过滤掉金额或权重非正的档位）
func GetCheckinPrizes() []CheckinPrize {
	prizes := make([]CheckinPrize, 0, len(checkinSetting.Prizes))
	for _, prize := range checkinSetting.Prizes {
		if prize.Amount > 0 && prize.Weight > 0 {
			prizes = append(prizes, prize)
		}
	}
	if len(prizes) == 0 {
		return append([]CheckinPrize(nil), DefaultCheckinPrizes...)
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
