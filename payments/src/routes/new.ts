import express, { Request, Response, Router } from "express";
import { body } from "express-validator";
import {
  OrderStatus,
  requireAuth,
  validateRequest,
  BadRequestError,
  NotFoundError,
  NotAuthorizedError
} from "@ticketsms/common";

import { Order } from "../models/order";
import { Payment } from '../models/payment';
import { PaymentCreatedEvent } from '../events/publishers/payment-created-publisher';
import { stripe } from '../stripe';
import { natsWrapper } from '../nats-wrapper';

const router: Router = express.Router();

router.post(
  "/api/payments",
  requireAuth,
  [body("token").not().isEmpty(), body("orderId").not().isEmpty()],
  validateRequest,
  async (req: Request, res: Response) => {
    const { token, orderId } = req.body;

    const order = await Order.findById(orderId);

    if(!order) {
      throw new NotFoundError();
    }

    if (order.userId !== req.currentUser!.id) {
      throw new NotAuthorizedError();
    }

    if (order.status === OrderStatus.Cancelled) {
      throw new BadRequestError('Cannot pay for a cancelled order!');
    }

    const charge = await stripe.charges.create({
      currency: 'usd',
      amount: order.price * 100,
      source: token
    });

    const payment = Payment.build({
      orderId!,
      stripeId: charge.id
    });

    await payment.save();

    new PaymentCreatedPublisher(natsWrapper.client).publish({
      id: payment.id,
      orderId: payment.orderId,
      stripeId: payment.stripeId
    });

    res.status(201).send({ id: payment.id });
  }
);

export { router as createChargeRouter };
