function getExerciseGifSources(exercise) {
  const id = String(exercise && exercise.id ? exercise.id : '').trim()
  const mediaId = String(exercise && exercise.media_id ? exercise.media_id : '').trim()
  if (!id || !mediaId) return []

  return [`https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/${encodeURIComponent(id)}-${encodeURIComponent(mediaId)}.gif`]
}

export { getExerciseGifSources }
