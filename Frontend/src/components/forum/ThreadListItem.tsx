import Link from 'next/link';
import { ForumThread } from '../../types/forum';

interface ThreadListItemProps {
  thread: ForumThread;
  canModerate: boolean;
  onPin: (threadId: string) => void;
  onUnpin: (threadId: string) => void;
  onLock: (threadId: string) => void;
  onUnlock: (threadId: string) => void;
}

export default function ThreadListItem({
  thread,
  canModerate,
  onPin,
  onUnpin,
  onLock,
  onUnlock,
}: ThreadListItemProps) {
  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        thread.isPinned
          ? 'bg-indigo-50/50 border-indigo-200'
          : 'bg-white border-gray-200 hover:border-indigo-300'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {thread.isPinned && (
              <span className="text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                📌 Pinned
              </span>
            )}
            {thread.isLocked && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                🔒 Locked
              </span>
            )}
            {thread.author.role !== 'Student' && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {thread.author.role}
              </span>
            )}
          </div>
          <Link
            href={`/forum/thread/${thread.id}`}
            className="block text-base font-semibold text-gray-900 mt-1.5 hover:text-indigo-700"
          >
            {thread.title}
          </Link>
          <p className="text-sm text-gray-500 mt-1">
            {thread.author.name} · {new Date(thread.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-gray-400 whitespace-nowrap">
          <span>{thread.likeCount} likes</span>
          <span>{thread.commentCount} replies</span>
        </div>
      </div>
      {canModerate && (
        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 text-xs font-medium">
          {thread.isPinned ? (
            <button onClick={() => onUnpin(thread.id)} className="text-gray-500 hover:text-gray-700">
              Unpin
            </button>
          ) : (
            <button onClick={() => onPin(thread.id)} className="text-gray-500 hover:text-gray-700">
              Pin
            </button>
          )}
          {thread.isLocked ? (
            <button onClick={() => onUnlock(thread.id)} className="text-gray-500 hover:text-gray-700">
              Unlock
            </button>
          ) : (
            <button onClick={() => onLock(thread.id)} className="text-gray-500 hover:text-gray-700">
              Lock
            </button>
          )}
        </div>
      )}
    </div>
  );
}