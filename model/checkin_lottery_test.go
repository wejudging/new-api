package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// withTopUpStep 在测试期间调整充值赠送门槛，结束后恢复
func withTopUpStep(t *testing.T, yuan float64) {
	t.Helper()
	setting := operation_setting.GetCheckinSetting()
	original := setting.TopUpYuanPerDraw
	setting.TopUpYuanPerDraw = yuan
	t.Cleanup(func() {
		setting.TopUpYuanPerDraw = original
	})
}

func migrateLotteryTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&CheckinLotteryTicketState{}, &CheckinLotteryTicket{}, &CheckinLotteryDraw{}))
}

// TestGrantTopUpLotteryTicketsPersistsTicketsAndRemainder 覆盖充值赠送的落库结果。
//
// 赠送次数和余量都必须真的写进数据库：余量列名写错会让整笔赠送以报错收场，
// 结果是用户充了钱却永远拿不到抽奖次数。
func TestGrantTopUpLotteryTicketsPersistsTicketsAndRemainder(t *testing.T) {
	migrateLotteryTables(t)
	withTopUpStep(t, 10)

	userId := 990101
	step := operation_setting.GetCheckinTopUpStepQuota()
	require.Greater(t, step, 0)

	// 到账 25 元：赠送 2 次，余下 5 元留给下一次
	granted, err := GrantTopUpLotteryTickets(DB, userId, step*2+step/2)
	require.NoError(t, err)
	require.Equal(t, 2, granted)

	state := &CheckinLotteryTicketState{}
	require.NoError(t, DB.Where("user_id = ?", userId).First(state).Error)
	require.Equal(t, 2, state.BonusTickets)
	require.Equal(t, int64(step/2), state.TopUpRemainder)

	var ledger int64
	require.NoError(t, DB.Model(&CheckinLotteryTicket{}).Where("user_id = ?", userId).Count(&ledger).Error)
	require.Equal(t, int64(1), ledger, "赠送次数必须留下流水")

	// 余量跨订单累计：再来 5 元正好凑满 1 次
	granted, err = GrantTopUpLotteryTickets(DB, userId, step/2)
	require.NoError(t, err)
	require.Equal(t, 1, granted)

	state = &CheckinLotteryTicketState{}
	require.NoError(t, DB.Where("user_id = ?", userId).First(state).Error)
	require.Equal(t, 3, state.BonusTickets)
	require.Equal(t, int64(0), state.TopUpRemainder)
}

// TestLotteryTicketUpsertQualifiesColumns 保证 upsert 的 SET 子句引用带表名的列。
//
// PostgreSQL 会把 ON CONFLICT ... DO UPDATE 里的裸列名判为歧义引用（SQLSTATE 42702），
// 语句报错后整个事务被标记为 aborted，充值到账会跟着一起回滚。
func TestLotteryTicketUpsertQualifiesColumns(t *testing.T) {
	migrateLotteryTables(t)

	recorder := &migrationSQLRecorder{}
	db := DB.Session(&gorm.Session{Logger: recorder})
	require.NoError(t, addUserLotteryTicketsTo(db, 990102, lotteryTicketPoolBonus, 3, LotteryTicketReasonTopUp))

	var upsert string
	for _, statement := range recorder.statements {
		if strings.Contains(statement, "ON CONFLICT") && strings.Contains(statement, "checkin_lottery_ticket_states") {
			upsert = statement
		}
	}
	require.NotEmpty(t, upsert, "未捕获到次数余额的 upsert 语句")
	require.Contains(t, upsert, "checkin_lottery_ticket_states."+lotteryTicketPoolBonus+" +",
		"SET 子句里的列名必须带表名，否则 PostgreSQL 事务会被整笔 abort")
}
