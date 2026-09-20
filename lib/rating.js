export function calculateEloRating(winnerRating, loserRating, draw = false, K = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  let actualWinner, actualLoser;
  if (draw) {
    actualWinner = 0.5;
    actualLoser = 0.5;
  } else {
    actualWinner = 1;
    actualLoser = 0;
  }

  const newWinnerRating = Math.round(winnerRating + K * (actualWinner - expectedWinner));
  const newLoserRating = Math.round(loserRating + K * (actualLoser - expectedLoser));

  return {
    winner: newWinnerRating,
    loser: newLoserRating,
  };
}

export function getRatingCategory(initialTimeSeconds) {
  if (initialTimeSeconds < 180) return 'blitzRating';
  if (initialTimeSeconds < 600) return 'rapidRating';
  return 'classicalRating';
}

export function updateUserRatings(user, result, category, K = 32) {
  user.gamesPlayed = (user.gamesPlayed || 0) + 1;

  if (result === 'win') {
    user.gamesWon = (user.gamesWon || 0) + 1;
  } else if (result === 'draw') {
    user.gamesDraw = (user.gamesDraw || 0) + 1;
  } else if (result === 'loss') {
    user.gamesLost = (user.gamesLost || 0) + 1;
  }

  const avgRating = Math.round(
    ((user.blitzRating || 1200) + (user.rapidRating || 1200) + (user.classicalRating || 1200)) / 3
  );
  user.rating = avgRating;

  return user;
}
