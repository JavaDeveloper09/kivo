export type ChannelType = 'TEXT' | 'VOICE'
export type Role = 'OWNER' | 'MEMBER'

export type Channel = { id: string; name: string; type: ChannelType; serverId: string; position: number }
export type Member = { id: string; username: string; displayName: string; role: Role; online: boolean }
export type Author = { id: string; username: string; displayName: string }
export type Message = { id: string; content: string; channelId: string; createdAt: string; author: Author }

export type VoiceUser = { userId: string; muted: boolean; deafened: boolean }

export type ServerSummary = { id: string; name: string; role: Role }
export type ServerDetail = {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  channels: Channel[]
  members: Member[]
  voice: Record<string, VoiceUser[]> // ses kanalı id -> içindekiler
  voiceEnabled: boolean
}
