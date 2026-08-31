<div className="mentor-card glassmorphic rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
  <div className="flex items-center gap-4">
    <img src={mentor.avatarUrl} alt={mentor.name} className="w-16 h-16 rounded-full" />
    <div>
      <h3 className="text-lg font-bold">{mentor.name}</h3>
      <p className="text-sm text-gray-500">{mentor.bio}</p>
    </div>
  </div>
  <div className="mt-4 flex gap-2">
    {mentor.availability.map((slot) => (
      <button
        key={slot}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:opacity-90"
        onClick={() => openBookingModal(mentor.id, slot)}
      >
        {slot}
      </button>
    ))}
  </div>
</div>
