function getExerciseGifSources(exercise) {
  const id = String(exercise && exercise.id ? exercise.id : '').trim()
  const mediaId = String(exercise && exercise.media_id ? exercise.media_id : '').trim()
  if (!id || !mediaId) return []

  return [
    `/static/gifs/${encodeURIComponent(id)}-${encodeURIComponent(mediaId)}.gif`,
    `https://v2.exercisedb.io/gif/${encodeURIComponent(mediaId)}`
  ]
}

export { getExerciseGifSources }
