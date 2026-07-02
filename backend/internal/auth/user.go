package auth

import "time"

type User struct {
	ID              string
	Email           string
	EmailVerifiedAt *time.Time
	NativeLanguage  string
	TargetLanguage  string
	UILanguage      string
	ActiveLanguage  UserLanguage
}

func (u User) IsEmailVerified() bool {
	return u.EmailVerifiedAt != nil
}
