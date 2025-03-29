"use client";

import { useState } from "react";
import styles from "../page.module.css";
import OwnerPartnerSlider from "../components/OwnerPartnerSlider";
import OwnerGoodsSlider from "../components/OwnerGoodsSlider";
import JournalSlider from "../components/JournalSlider";

export default function Owners() {
  const [currentPartnerId, setCurrentPartnerId] = useState(1);
  const [showGoods, setShowGoods] = useState(true);
  const [showJournal, setShowJournal] = useState(false);
  const [showPartners, setShowPartners] = useState(true);

  const handleGoodChange = (partnerId) => {
    setCurrentPartnerId(partnerId);
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <button
          className={styles.viewGoodsButton}
          onClick={() => setShowJournal(!showJournal)}
        >
          {showJournal ? "Hide Journal" : "View Journal"}
        </button>

        <JournalSlider isVisible={showJournal} />
        <OwnerGoodsSlider
          onGoodChange={handleGoodChange}
          isVisible={showGoods}
        />
        <button
          className={styles.viewGoodsButton}
          onClick={() => setShowPartners(!showPartners)}
        >
          {showPartners ? "Hide Partners" : "Show Partners"}
        </button>
        <OwnerPartnerSlider
          partnerId={currentPartnerId}
          isVisible={showPartners}
        />
      </main>
    </div>
  );
}
