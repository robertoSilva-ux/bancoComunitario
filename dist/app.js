import express from "express";
export const app = express();
app.use(express.json());
app.get("/", (_request, response) => {
    return response.status(200).json({ message: "Community Bank API" });
});
app.get("/health", (_request, response) => {
    return response.status(200).json({ status: "ok" });
});
