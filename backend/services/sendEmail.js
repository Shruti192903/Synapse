import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendEmail = async ({ to, subject, html, text }) => {
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Email credentials (EMAIL_USER/EMAIL_PASS) are not set in .env.');
    }

    const mailData = {
        from: `Synapse Agent <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || "This is a system-generated email from Synapse Agent. Please view in an HTML-enabled client." 
    };

    try {
        const info = await transporter.sendMail(mailData);
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Nodemailer error:', error);
        throw new Error(`Failed to send email to ${to}: ${error.message}`);
    }
};