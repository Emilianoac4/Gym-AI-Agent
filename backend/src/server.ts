import { app } from "./app";
import { env } from "./config/env";
import { startDailyMembershipSummaryJob } from "./services/membership-summary.service";

app.listen(env.PORT, () => {
  console.log(`GymAI backend running on http://localhost:${env.PORT}`);
  startDailyMembershipSummaryJob();
});
