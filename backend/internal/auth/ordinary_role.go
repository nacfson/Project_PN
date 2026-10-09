package auth

import (
	"errors"
	"slices"
)

var ErrEmptyCapabilities = errors.New("ordinary role capability set cannot be empty")

// Canonical Ordinary capabilities for Project PN (001-gateway-jwt-auth)
const (
	CapLearningReadOwn  = "learning.read_own"
	CapLearningWriteOwn = "learning.write_own"
	CapDecksManageOwn   = "decks.manage_own"
	CapProfileReadOwn   = "profile.read_own"
	CapProfileWriteOwn  = "profile.write_own"
	CapMergeParticipate = "merge.participate"
)

var DefaultOrdinaryCapabilities = []string{
	CapLearningReadOwn,
	CapLearningWriteOwn,
	CapDecksManageOwn,
	CapProfileReadOwn,
	CapProfileWriteOwn,
	CapMergeParticipate,
}

// OrdinaryRole encapsulates declared capabilities for ordinary learners.
// Missing declaration fails closed. There is no application-administrator role.
type OrdinaryRole struct {
	capabilities []string
}

func NewOrdinaryRole(caps []string) (*OrdinaryRole, error) {
	if len(caps) == 0 {
		return nil, ErrEmptyCapabilities
	}
	return &OrdinaryRole{
		capabilities: slices.Clone(caps),
	}, nil
}

func (r *OrdinaryRole) Capabilities() []string {
	if r == nil {
		return nil
	}
	return slices.Clone(r.capabilities)
}

func (r *OrdinaryRole) Allows(capability string) bool {
	if r == nil {
		return false
	}
	return slices.Contains(r.capabilities, capability)
}

// OrdinaryCapabilities returns the canonical ordinary capability set.
func OrdinaryCapabilities() []string {
	return slices.Clone(DefaultOrdinaryCapabilities)
}

