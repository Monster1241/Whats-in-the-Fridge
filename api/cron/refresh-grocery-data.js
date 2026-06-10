import { createGroceryCronHandler } from '../../server/groceryCronHandler.js';

/** Manual / legacy entry — accepts ?mode=sneakPeek|officialReset */
export default createGroceryCronHandler('officialReset');
