package controller

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const lotteryLeaderboardSize = 10

// GetCheckinLotteryStatus 获取签到抽奖状态、奖池与手气榜
func GetCheckinLotteryStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	userId := c.GetInt("id")

	requireTopUp, topUpSatisfied, err := checkinTopUpGate(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	dailyTickets, bonusTickets, err := model.GetUserLotteryTicketBuckets(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	checkedInToday, err := model.HasCheckedInToday(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	stats, err := model.GetUserLotteryStats(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	rank, _, err := model.GetUserLotteryRank(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	leaderboard, err := model.GetLotteryLeaderboard(lotteryLeaderboardSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":             setting.Enabled,
			"require_topup":       requireTopUp,
			"topup_satisfied":     topUpSatisfied,
			"daily_draws":         operation_setting.GetCheckinDailyDraws(),
			"tickets":             dailyTickets + bonusTickets,
			"daily_tickets":       dailyTickets,
			"bonus_tickets":       bonusTickets,
			"topup_yuan_per_draw": operation_setting.GetCheckinTopUpYuanPerDraw(),
			"checked_in_today":    checkedInToday,
			"prizes":              buildLotteryPrizePayload(),
			"expected_amount":     operation_setting.GetCheckinPrizeExpectedAmount(),
			"stats":               stats,
			"rank":                rank,
			"leaderboard":         leaderboard,
			"leaderboard_count":   lotteryLeaderboardSize,
		},
	})
}

// DoCheckinLotteryDraw 执行一次签到抽奖（次数不足时自动领取当日次数）
func DoCheckinLotteryDraw(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到抽奖未启用")
		return
	}

	userId := c.GetInt("id")

	if _, satisfied, err := checkinTopUpGate(c); err != nil {
		common.ApiError(c, err)
		return
	} else if !satisfied {
		common.ApiError(c, ErrCheckinTopUpRequired)
		return
	}

	tickets, err := model.GetUserLotteryTickets(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 没有可用次数时，先尝试领取当日次数（今日已签到会返回错误）
	if tickets < 1 {
		if _, claimed, err := model.UserCheckin(userId); err == nil {
			message := "用户签到"
			if claimed > 0 {
				message = fmt.Sprintf("用户签到，获得 %d 次抽奖机会", claimed)
			}
			model.RecordLog(userId, model.LogTypeSystem, message)
			tickets, _ = model.GetUserLotteryTickets(userId)
		}
	}

	if tickets < 1 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": model.ErrLotteryNoTicket.Error(),
		})
		return
	}

	draw, err := model.DrawUserLottery(userId)
	if err != nil {
		if errors.Is(err, model.ErrLotteryNoTicket) || errors.Is(err, model.ErrLotteryDisabled) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		common.ApiError(c, err)
		return
	}

	model.RecordLog(userId, model.LogTypeSystem,
		fmt.Sprintf("签到抽奖获得 %s，发放额度 %s", formatLotteryAmount(draw.Amount), logger.LogQuota(draw.Quota)))

	remaining, _ := model.GetUserLotteryTickets(userId)
	checkedInToday, _ := model.HasCheckedInToday(userId)
	stats, _ := model.GetUserLotteryStats(userId)
	rank, _, _ := model.GetUserLotteryRank(userId)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "抽奖成功",
		"data": gin.H{
			"amount":           draw.Amount,
			"quota":            draw.Quota,
			"tickets":          remaining,
			"checked_in_today": checkedInToday,
			"stats":            stats,
			"rank":             rank,
		},
	})
}

// buildLotteryPrizePayload 组装奖池展示数据
func buildLotteryPrizePayload() []gin.H {
	prizes := operation_setting.GetCheckinPrizes()
	total := operation_setting.GetCheckinPrizeWeights()
	payload := make([]gin.H, 0, len(prizes))
	for _, prize := range prizes {
		probability := 0.0
		if total > 0 {
			probability = float64(prize.Weight) / float64(total)
		}
		payload = append(payload, gin.H{
			"amount":      prize.Amount,
			"weight":      prize.Weight,
			"probability": probability,
		})
	}
	return payload
}

// GetCheckinLotteryRecords 获取当前用户的抽奖记录 / 抽奖次数流水
//
// 查询参数 type=draw 返回抽奖记录（默认），type=ticket 返回次数流水。
func GetCheckinLotteryRecords(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	if c.Query("type") == "ticket" {
		logs, total, err := model.GetUserLotteryTicketLogs(userId, pageInfo)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		pageInfo.SetTotal(int(total))
		pageInfo.SetItems(logs)
		common.ApiSuccess(c, pageInfo)
		return
	}

	draws, total, err := model.GetUserLotteryDraws(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(draws)
	common.ApiSuccess(c, pageInfo)
}

// formatLotteryAmount 格式化奖品金额（人民币元）
func formatLotteryAmount(amount float64) string {
	return fmt.Sprintf("¥%.2f", amount)
}
