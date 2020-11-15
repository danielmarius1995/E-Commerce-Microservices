import express, { Router } from 'express';

const router: Router = express.Router();

router.post('/api/users/signin', (req, res) => {
  res.send('Hi there!');
});

export { router as signinRouter };
