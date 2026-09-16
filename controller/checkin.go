package controller

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// ErrCheckinTopUpRequired 未充值过的账号不能参与签到抽奖
var ErrCheckinTopUpRequired = errors.New("签到抽奖仅对有过充值记录的用户开放，充值任意金额后即可参与")

// checkinTopUpGate 校验「仅限有过充值记录的用户参与」这道门槛
//
// 批量注册的小号只能从接口侧拦住：前端隐藏入口挡不住直接调用接口，
// 所以签到与抽奖的每个写接口都会走一次这里的校验。
// 返回 required 表示门槛是否开启，satisfied 表示当前用户是否已满足。
// 管理员不受门槛限制，便于上线后自测与排查。
func checkinTopUpGate(c *gin.Context) (required bool, satisfied bool, err error) {
	if !operation_setting.IsCheckinTopUpRequired() {
		return false, true, nil
	}
	if c.GetInt("role") >= common.RoleAdminUser {
		return true, true, nil
	}
	hasTopUp, err := model.HasSuccessfulTopUp(c.GetInt("id"))
	if err != nil {
		common.SysError("校验充值记录失败：" + err.Error())
		return true, false, errors.New("签到抽奖暂时不可用，请稍后重试")
	}
	return true, hasTopUp, nil
}

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}
	userId := c.GetInt("id")
	requireTopUp, topUpSatisfied, err := checkinTopUpGate(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 获取月份参数，默认为当前月份
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	tickets, _ := model.GetUserLotteryTickets(userId)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":         setting.Enabled,
			"require_topup":   requireTopUp,
			"topup_satisfied": topUpSatisfied,
			"min_quota":       setting.MinQuota,
			"max_quota":       setting.MaxQuota,
			"daily_draws":     operation_setting.GetCheckinDailyDraws(),
			"tickets":         tickets,
			"stats":           stats,
		},
	})
}

// DoCheckin 执行用户签到（领取每日抽奖次数）
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}

	if _, satisfied, err := checkinTopUpGate(c); err != nil {
		common.ApiError(c, err)
		return
	} else if !satisfied {
		common.ApiError(c, ErrCheckinTopUpRequired)
		return
	}

	userId := c.GetInt("id")

	checkin, tickets, err := model.UserCheckin(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("用户签到，获得 %d 次抽奖机会", tickets))
	total, _ := model.GetUserLotteryTickets(userId)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "签到成功",
		"data": gin.H{
			"quota_awarded":   checkin.QuotaAwarded,
			"checkin_date":    checkin.CheckinDate,
			"tickets_awarded": tickets,
			"tickets":         total,
		},
	})
}
