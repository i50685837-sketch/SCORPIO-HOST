const Project = require("../models/Project");

exports.create = async (req, res) => {
    try {
        const {
            name,
            description,
            repository,
            language
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Project name is required"
            });
        }

        const project = await Project.create({
            user: req.user.id,
            name,
            description,
            repository,
            language
        });

        res.status(201).json({
            success: true,
            project
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to create project"
        });
    }
};

exports.list = async (req, res) => {
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
};

exports.get = async (req, res) => {
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
};

exports.remove = async (req, res) => {
    try {
        const project =
            await Project.findOneAndDelete({
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
};
