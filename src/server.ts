import app from "./app";
import env from "../config/env";

const port = env.PORT || 5001;
const server = app.listen(port, () => console.log(`Server started on port ${port}`));

export default server;