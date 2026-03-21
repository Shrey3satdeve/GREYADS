import { 
  collection, 
  setDoc, 
  doc, 
  serverTimestamp, 
  getDocs,
  deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";

const EVENTS = [
  {
    title: "Neon Dreams Music Festival",
    description: "An unforgettable night of electronic music, live performances, and mesmerizing light shows.",
    date: new Date("2026-03-14T20:00:00Z"),
    venue: "MMRDA Grounds, BKC, Mumbai",
    cover_image_url: "https://images.unsplash.com/photo-1571751239008-50cad6cb9265?w=800&q=80",
    category: "Music",
    price: 999,
    total_tickets: 500,
    available_tickets: 500,
    organizer_name: "GreyAdz Events",
    tags: ["music", "festival", "electronic"],
    status: "upcoming"
  },
  {
    title: "Tech Summit 2026",
    description: "Connect with India's brightest minds in technology. World-class keynotes and workshops.",
    date: new Date("2026-03-19T09:00:00Z"),
    venue: "Bombay Exhibition Centre, Goregaon",
    cover_image_url: "https://images.unsplash.com/photo-1540317228636-69a076b0b248?w=800&q=80",
    category: "Technology",
    price: 1499,
    total_tickets: 300,
    available_tickets: 300,
    organizer_name: "TechIndia",
    tags: ["tech", "startup", "networking"],
    status: "upcoming"
  }
];

export const seedFirestore = async () => {
  console.log("🌱 Seeding Firestore...");
  
  try {
    // 1. Seed Events
    const eventsCol = collection(db, "events");
    for (const event of EVENTS) {
      const docRef = doc(eventsCol);
      await setDoc(docRef, {
        ...event,
        created_at: serverTimestamp(),
      });
      console.log(`✅ Added Event: ${event.title}`);
    }

    console.log("✨ Seeding complete!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  }
};
