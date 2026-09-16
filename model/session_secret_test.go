package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

// withCleanSessionSecret 清空密钥表，并把内存中的密钥还原成启动时的随机值。
func withCleanSessionSecret(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&SessionSecretRecord{}))
	require.NoError(t, DB.Where("1 = 1").Delete(&SessionSecretRecord{}).Error)
	t.Setenv("SESSION_SECRET", "")
	t.Setenv("CRYPTO_SECRET", "")

	previousSecret := common.SessionSecret
	previousCrypto := common.CryptoSecret
	t.Cleanup(func() {
		common.SessionSecret = previousSecret
		common.CryptoSecret = previousCrypto
	})
}

// TestSessionSecretSurvivesRestart 覆盖重启后会话密钥保持不变：密钥一变，刷新令牌
// 摘要就对不上库里的记录，所有用户被迫重新登录，等价于「每次更新版本都要重登」。
func TestSessionSecretSurvivesRestart(t *testing.T) {
	withCleanSessionSecret(t)

	require.NoError(t, InitSessionSecret())
	firstSecret := common.SessionSecret
	require.Len(t, firstSecret, sessionSecretLength)
	require.Equal(t, firstSecret, common.CryptoSecret, "未配置 CRYPTO_SECRET 时应跟随会话密钥")

	// 模拟新容器启动：内存里的密钥回到随机默认值，再从库里读回来。
	common.SessionSecret = "restart-random-value"
	common.CryptoSecret = "restart-random-value"

	require.NoError(t, InitSessionSecret())
	require.Equal(t, firstSecret, common.SessionSecret)
	require.Equal(t, firstSecret, common.CryptoSecret)

	var stored SessionSecretRecord
	require.NoError(t, DB.Where("slot = ?", sessionSecretSlot).First(&stored).Error)
	require.Equal(t, firstSecret, stored.Secret)
}

// TestSessionSecretKeepsOperatorOverride 确认配置了 SESSION_SECRET 时以其为准且不写库。
func TestSessionSecretKeepsOperatorOverride(t *testing.T) {
	withCleanSessionSecret(t)
	t.Setenv("SESSION_SECRET", "operator-configured-secret")
	common.SessionSecret = "operator-configured-secret"

	require.NoError(t, InitSessionSecret())
	require.Equal(t, "operator-configured-secret", common.SessionSecret)

	var count int64
	require.NoError(t, DB.Model(&SessionSecretRecord{}).Count(&count).Error)
	require.Zero(t, count, "配置了环境变量就不该再落库")
}

// TestSessionSecretRejectsEmptyStoredValue 确认库中密钥为空时报错，而不是静默换一个密钥。
func TestSessionSecretRejectsEmptyStoredValue(t *testing.T) {
	withCleanSessionSecret(t)
	require.NoError(t, DB.Create(&SessionSecretRecord{Slot: sessionSecretSlot, Secret: ""}).Error)

	require.Error(t, InitSessionSecret())
}
