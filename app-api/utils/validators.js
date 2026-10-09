function toNumber(value) {
  if (value === '' || value === null || value === undefined) return NaN
  return Number(value)
}

function validateSetDetails(setDetails) {
  if (!Array.isArray(setDetails) || !setDetails.length) {
    return { valid: false, message: '至少填写一组训练数据' }
  }

  const normalized = []
  for (let index = 0; index < setDetails.length; index += 1) {
    const item = setDetails[index] || {}
    const weight = toNumber(item.weight)
    const reps = toNumber(item.reps)
    const setNo = Number(item.setNo) || index + 1
    if (!Number.isFinite(weight) || weight < 0) {
      return { valid: false, message: '第 ' + (index + 1) + ' 组请输入有效的重量' }
    }
    if (!Number.isInteger(reps) || reps <= 0) {
      return { valid: false, message: '第 ' + (index + 1) + ' 组次数必须是正整数' }
    }
    if (setNo !== index + 1) {
      return { valid: false, message: '训练组编号不连续，请重新添加' }
    }
    normalized.push({ setNo: index + 1, weight, reps })
  }
  return { valid: true, value: normalized }
}

function validateTrainForm({ weight, sets, reps, setDetails } = {}) {
  if (Array.isArray(setDetails)) {
    const detailsResult = validateSetDetails(setDetails)
    if (!detailsResult.valid) return detailsResult
    const first = detailsResult.value[0]
    return {
      valid: true,
      value: {
        setDetails: detailsResult.value,
        weight: first.weight,
        sets: detailsResult.value.length,
        reps: first.reps
      }
    }
  }

  const weightValue = toNumber(weight)
  const setsValue = toNumber(sets)
  const repsValue = toNumber(reps)
  if (!Number.isFinite(weightValue) || weightValue < 0) return { valid: false, message: '请输入有效的重量' }
  if (!Number.isInteger(setsValue) || setsValue <= 0) return { valid: false, message: '组数必须是正整数' }
  if (!Number.isInteger(repsValue) || repsValue <= 0) return { valid: false, message: '每组次数必须是正整数' }
  return {
    valid: true,
    value: {
      setDetails: Array.from({ length: setsValue }, (_, index) => ({
        setNo: index + 1,
        weight: weightValue,
        reps: repsValue
      })),
      weight: weightValue,
      sets: setsValue,
      reps: repsValue
    }
  }
}

function validateWeight(value) {
  const weight = toNumber(value)
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) return { valid: false, message: '请输入 0-500 kg 内的体重' }
  return { valid: true, value: weight }
}

function isExercise(value) {
  return Boolean(value && value.id && value.name_zh && value.target && value.media_id && value.instructions_zh)
}

export { validateSetDetails, validateTrainForm, validateWeight, isExercise }
