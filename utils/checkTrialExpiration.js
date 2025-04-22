// ユーザーのトライアルが終了しているか確認する関数
const checkTrialExpired = async (userRef) => {
  const userDoc = await userRef.get();
  const createdAt = userDoc.data().createdAt;
  const now = Date.now();

  // 14日（2週間）＝ 1209600000ms
  if (now - createdAt > 1209600000) {
    await userRef.update({ gpt_mode: "expired" });
    return true;
  }
  return false;
};

module.exports = checkTrialExpired;
