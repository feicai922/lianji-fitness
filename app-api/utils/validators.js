function toNumber(value) {
  if (value === '' || value === null || value === undefined) return NaN
  return Number(value)
}

function validateTrainForm({ weight, sets, reps } = {}) {
  const weightValue = toNumber(weight)
  const setsValue = toNumber(sets)
  const repsValue = toNumber(reps)
  if (!Number.isFinite(weightValue) || weightValue < 0) return { valid: false, message: '请输入有效的重量' }
  if (!Number.isInteger(setsValue) || setsValue <= 0) return { valid: false, message: '组数必须是正整数' }
  if (!Number.isInteger(repsValue) || repsValue <= 0) return { valid: false, message: '每组次数必须是正整数' }
  return { valid: true, value: { weight: weightValue, sets: setsValue, reps: repsValue } }
}

function validateWeight(value) {
  const weight = toNumber(value)
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) return { valid: false, message: '请输入 0-500 kg 内的体重' }
  return { valid: true, value: weight }
}

function isExercise(value) {
  return Boolean(value && value.id && value.name_zh && value.target && value.media_id && value.instructions_zh)
}

export { validateTrainForm, validateWeight, isExercise }
