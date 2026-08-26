const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const Project = require("../models/Project");

router.get("/", auth, async (req, res) => {
    try {
        const projects = await Project.find({
            user: req.user.id
        }).sort({
            createdAt: -1
        });

        res.json({
            success: true,
            projects
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load projects"
        });
    }
});

router.post("/", auth, async (req, res) => {
    try {
        const project = await Project.create({
            ...req.body,
            user: req.user.id
        });

        res.status(201).json({
            success: true,
            project
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/:id", auth, async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        res.json({
            success: true,
            project
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load project"
        });
    }
});

router.delete("/:id", auth, async (req, res) => {
    try {
        const project = await Project.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        res.json({
            success: true,
            message: "Project deleted"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to delete project"
        });
    }
});

module.exports = router;
