package model

import (
	"errors"
	"fmt"
	"os"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const sessionSecretSlot = "session"

// sessionSecretLength 持久化密钥的随机字符长度
const sessionSecretLength = 64

// SessionSecretRecord 保存会话签名密钥
//
// 该密钥参与访问令牌签名、刷新令牌摘要以及 user session 缓存 key 的派生，
// 因此只允许落库保存，不经由管理端选项暴露。
type SessionSecretRecord struct {
	Id     int    `json:"-" gorm:"primaryKey;autoIncrement"`
	Slot   string `json:"-" gorm:"type:varchar(32);not null;uniqueIndex"`
	Secret string `json:"-" gorm:"type:text;not null"`
}

func (SessionSecretRecord) TableName() string {
	return "session_secret_records"
}

// InitSessionSecret 加载会话签名密钥，缺失时生成并落库
//
// 上游默认在每次启动时随机生成密钥，容器重建后签名密钥就变了：已签发的访问
// 令牌校验失败，刷新令牌摘要（依赖同一个密钥派生）也对不上库里的记录，于是所有
// 用户被迫重新登录。把密钥持久化即可让会话跨重启存活。
// 已显式配置 SESSION_SECRET 的部署保持原有行为，直接用配置值。
func InitSessionSecret() error {
	if os.Getenv("SESSION_SECRET") != "" {
		return nil
	}
	if DB == nil {
		return errors.New("session secret requires an initialized database")
	}
	secret, err := loadOrCreateSessionSecret()
	if err != nil {
		return err
	}
	if secret == "" {
		return errors.New("persisted session secret is empty")
	}
	common.ApplyPersistedSessionSecret(secret)
	return nil
}

func loadOrCreateSessionSecret() (string, error) {
	var stored SessionSecretRecord
	queryErr := DB.Where("slot = ?", sessionSecretSlot).First(&stored).Error
	switch {
	case queryErr == nil:
		return stored.Secret, nil
	case !errors.Is(queryErr, gorm.ErrRecordNotFound):
		return "", fmt.Errorf("read session secret: %w", queryErr)
	}

	generated, err := common.GenerateRandomCharsKey(sessionSecretLength)
	if err != nil {
		return "", fmt.Errorf("generate session secret: %w", err)
	}
	candidate := SessionSecretRecord{Slot: sessionSecretSlot, Secret: generated}
	if err := DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "slot"}},
		DoNothing: true,
	}).Create(&candidate).Error; err != nil {
		return "", fmt.Errorf("persist session secret: %w", err)
	}

	// 多副本同时首次启动时，抢输的一方读回赢家写入的密钥，保证集群内一致
	if err := DB.Where("slot = ?", sessionSecretSlot).First(&stored).Error; err != nil {
		return "", fmt.Errorf("reload session secret: %w", err)
	}
	return stored.Secret, nil
}
