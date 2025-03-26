"use client";

import { useState } from "react";
import styles from "./page.module.css";
import PartnerSlider from "./components/PartnerSlider";
import GoodsSlider from "./components/GoodsSlider";

export default function Home() {
  const [currentPartnerId, setCurrentPartnerId] = useState(1);
  const [showGoods, setShowGoods] = useState(false);

  const handlePartnerChange = (partnerIndex) => {
    setCurrentPartnerId(partnerIndex + 1);
    setShowGoods(false);
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.header}>Partners by Goods</h1>
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
