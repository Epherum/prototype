"use client";

import { useState } from "react";
import styles from "./page.module.css";
import PartnerSlider from "./components/PartnerSlider";
import GoodsSlider from "./components/GoodsSlider";
import JournalSlider from "./components/JournalSlider";

export default function Home() {
  const [currentPartnerId, setCurrentPartnerId] = useState(1);
  const [showGoods, setShowGoods] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

  const handlePartnerChange = (partnerIndex) => {
    setCurrentPartnerId(partnerIndex + 1);
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
        <PartnerSlider onPartnerChange={handlePartnerChange} />
        <button
          className={styles.viewGoodsButton}
          onClick={() => setShowGoods(!showGoods)}
        >
          {showGoods ? "Hide Goods" : "View Goods"}
        </button>
        <GoodsSlider partnerId={currentPartnerId} isVisible={showGoods} />
      </main>
    </div>
  );
}
