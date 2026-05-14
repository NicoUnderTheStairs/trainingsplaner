/**
 * Date, Teams -> collection
 * Player subcollection (User ref + active + stats)
 */

import db from "../../firebase";
import { setDoc, doc, addDoc, collection } from "firebase/firestore";

export async function createExcercise(
  date: Date,
  homeTeam: string,
  guestTeam: string,
  players: Player[],
  gameFinished: boolean,
  gameType?: string | null,
) {
  try {
    // Check if user has selected at least 6 players and homeTeam and guestTeam are defined
    if (players.length < 6 || !homeTeam || !guestTeam) {
      return;
    }

    // Create a new game document
    const newGameRef = await addDoc(collection(db, "Games"), {
      date,
      homeTeam,
      guestTeam,
      gameFinished,
      youtubeLink:
        masterSettingsData?.defaultYouTubeLink ||
        "https://youtube.com/playlist?list=PL33YIE1L3ZpgBpCBtnn5uAyW_anEFB7h8&si=6bBXRk_5BeP_mGmB",
      endscore,
      gameType,
    });

    // Create a subcollection for players
    const playerCollectionRef = collection(newGameRef, "Players");

    // Add game id to the season's game collection and set document ID to the new game id
    if (masterSettingsData?.currentSeason?.seasonID) {
      await setDoc(
        doc(
          db,
          `Seasons/${masterSettingsData.currentSeason.seasonID}/GamesCollection`,
          newGameRef.id,
        ),
        {
          gameId: newGameRef.id,
          date: date,
        },
      );
    }

    // Add active players to the subcollection
    await Promise.all(
      players.map(async (player, i) => {
        // players.map(async (player) => {
        // Add the player stats
        player.active = true;
        if (i <= 6) {
          player.active = true; // Set active to true if player index is less than or equal to 7
        } else {
          player.active = false; // Set active to false if player index is greater than 7
        }
        const playerWithStats = addStatsToPlayer(player);

        // Use `setDoc` to set player with specific ID (assuming player.id exists)
        const playerDocRef = doc(playerCollectionRef, player.id); // Set the document ID to player.id
        await setDoc(playerDocRef, playerWithStats); // Write the player data to the document with the custom ID
      }),
    );

    // Redirect to the active game with the new game id
    window.location.href = `/game-active?gameid=${newGameRef.id}`;
  } catch (e) {
    console.error("Error writing document: ", e);
  }
}

function addStatsToPlayer(player: Player): PlayerWithStats {
  return {
    ...player,
    attack: { error: 0, kill: 0, hits: 0 },
    block: { error: 0, neutral: 0, kill: 0 },
    service: { neutral: 0, error: 0, ace: 0 },
    receive: { error: 0, positive: 0, negative: 0 },
  };
}
