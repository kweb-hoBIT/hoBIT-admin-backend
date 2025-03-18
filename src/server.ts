import app from "./app";

const port = process.env.PORT || 5001;
const server = app.listen(port, () => console.log(`Server started on port ${port}`));

export default server;