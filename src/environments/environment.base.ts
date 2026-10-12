/** Values shared by every build. None of them is secret - they end up in the public bundle. */
export const baseEnvironment = {
  /** Movienee backend (Ktor on Render). */
  apiBaseUrl: 'https://movielensbackendktor.onrender.com',
  firebase: {
    apiKey: 'AIzaSyC4pQIspV9RsDkSqd2EiYlMtoUignmuNm4',
    authDomain: 'movielens-90309.firebaseapp.com',
    projectId: 'movielens-90309',
    storageBucket: 'movielens-90309.firebasestorage.app',
    messagingSenderId: '688395138951',
    appId: '1:688395138951:web:e0ef8628aa4fad8eaa4522',
  },
};
