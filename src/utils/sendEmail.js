const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})
transporter.verify((error, success) => {
  if (error) {
    console.log("SMTP ERROR:", error)
  } else {
    console.log("SMTP READY")
  }
})

const sendInviteEmail = async (toEmail, inviteLink) => {
      // console.log("EMAIL_USER:", process.env.EMAIL_USER)
      // console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS)
      // console.log("Sending mail to:", toEmail)
  const mailOptions = {
    from: `"Varadhi Club" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'You are invited to Varadhi Tracker',
    html: `
      <h2>Welcome to Varadhi Tracker</h2>
      <p>You have been invited to join Varadhi Tracker.</p>
      <p>Click the button below to setup your account:</p>
        <a href="${inviteLink}"
     style="
       display:inline-block;
       padding:12px 24px;
       background:#7c3aed;
       color:white;
       text-decoration:none;
       border-radius:8px;
       font-weight:bold;
     ">
     Accept Invitation
  </a>
    `
  }

  await transporter.sendMail(mailOptions)
// const info = await transporter.sendMail(mailOptions)
// console.log("MAIL SENT:", info)
}

module.exports = { sendInviteEmail }