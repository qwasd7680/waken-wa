'use client'

import { useActivityFeed } from '@/hooks/use-activity-feed'

interface UserProfileProps {
  name?: string
  bio?: string
  avatarUrl?: string
  note?: string
}

export function UserProfile({
  name = 'User',
  bio = 'Building something awesome',
  avatarUrl = '/avatar.jpg',
  note = '',
}: UserProfileProps) {
  const { feed } = useActivityFeed()
  const isOnline = Boolean(feed?.activeStatuses?.length)

  return (
    <div className="space-y-6">
      {/* Top Row: avatar + name/bio */}
      <div className="flex items-center gap-4">
        {/* Avatar — online: green dot, offline: red dot */}
        <div
          className="relative flex-shrink-0"
          aria-label={isOnline ? '在线' : '离线'}
        >
          <div
            className={`w-[4.5rem] h-[4.5rem] rounded-full overflow-hidden border-2 ring-2 ring-background ${
              isOnline ? 'border-online/60' : 'border-destructive/50'
            }`}
          >
            <img
              src={avatarUrl}
              alt={name}
              width={72}
              height={72}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div
            className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-[3px] border-background shadow-sm ${
              isOnline ? 'bg-online animate-pulse' : 'bg-destructive'
            }`}
            title={isOnline ? '在线' : '离线'}
          />
        </div>

        {/* Name & Bio */}
        <div>
          <h1 className="text-base font-semibold text-foreground leading-snug">
            {name}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-0.5">
            {bio}
          </p>
        </div>
      </div>

      {/* Note / Thought of the day */}
      {note && (
        <p className="text-sm text-foreground/70 font-light leading-relaxed border-l-2 border-primary pl-4">
          {note}
        </p>
      )}
    </div>
  )
}
