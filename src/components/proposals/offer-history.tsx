type Offer = {
  id: string;
  offerNumber: number;
  senderId: string;
  proposedPrice: string;
  deliveryDays: number;
  message: string;
  createdAt: Date;
};

type OfferHistoryProps = {
  offers: Offer[];
  currentUserId: string;
  clientId: string;
  freelancerId: string;
  originalProposal: {
    proposedPrice: string;
    currency: string;
    deliveryDays: number;
    submittedAt: Date;
  };
};

export default function OfferHistory({
  offers,
  currentUserId,
  clientId,
  freelancerId,
  originalProposal,
}: OfferHistoryProps) {
  const formatPrice = (price: string) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: originalProposal.currency,
    }).format(Number(price));

  function getSenderLabel(senderId: string) {
    if (senderId === currentUserId) return "You";
    if (senderId === clientId) return "Client";
    if (senderId === freelancerId) return "Freelancer";
    return "Unknown participant";
  }

  return (
    <section>
      <h3>Negotiation history</h3>

      <article>
        <h4>Original proposal</h4>
        <p>Freelancer</p>
        <p>Price: {formatPrice(originalProposal.proposedPrice)}</p>
        <p>Delivery: {originalProposal.deliveryDays} days</p>
        <small>
          {new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(originalProposal.submittedAt)}
        </small>
      </article>

      {offers.map((offer) => (
        <article key={offer.id}>
          <h4>Counteroffer #{offer.offerNumber}</h4>
          <p>Sent by: {getSenderLabel(offer.senderId)}</p>
          <p>Price: {formatPrice(offer.proposedPrice)}</p>
          <p>Delivery: {offer.deliveryDays} days</p>
          <p>{offer.message}</p>
          <small>
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(offer.createdAt)}
          </small>
        </article>
      ))}
    </section>
  );
}