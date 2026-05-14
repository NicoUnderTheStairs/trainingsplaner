import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getDatabase, ref, set } from "firebase/database";

export const registerUser = async (
  userUid: string,
  userName: string,
  email: string,
) => {
  try {
    // Initialize Firestore and Realtime Database here to ensure the Firebase app
    // has been initialized before these services are requested.
    const db = getFirestore();
    const rtdb = getDatabase();

    // Write user profile to Firestore
    await setDoc(doc(db, "Users", userUid), {
      userName,
      email,
    });

    // Write initial entry to Realtime Database
    await set(ref(rtdb, `users/${userUid}`), {
      userName,
      email,
      lat: null, // initial location
      lng: null,
      speed: 0,
      heading: 0,
      updatedAt: Date.now(),
      online: true,
    });
  } catch (error) {
    console.error("Error registering user:", error);
  }
};
