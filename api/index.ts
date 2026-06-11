import { app } from "../server";
export default app;

// Disable Vercel's default body parser to let Express's raw json body parser consume the request stream
export const config = {
  api: {
    bodyParser: false,
  },
};
