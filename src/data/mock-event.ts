import cover from "@/assets/event-cover.jpg";
import p1 from "@/assets/photo-1.jpg";
import p2 from "@/assets/photo-2.jpg";
import p3 from "@/assets/photo-3.jpg";
import p4 from "@/assets/photo-4.jpg";
import p5 from "@/assets/photo-5.jpg";
import p6 from "@/assets/photo-6.jpg";
import p7 from "@/assets/photo-7.jpg";
import p8 from "@/assets/photo-8.jpg";
import p9 from "@/assets/photo-9.jpg";
import p10 from "@/assets/photo-10.jpg";
import p11 from "@/assets/photo-11.jpg";
import p12 from "@/assets/photo-12.jpg";
import p13 from "@/assets/photo-13.jpg";
import p14 from "@/assets/photo-14.jpg";
import p15 from "@/assets/photo-15.jpg";

export type Comment = {
  id: string;
  author: string;
  initials: string;
  text: string;
  date: string;
};

export type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  author: string;
  initials: string;
  date: string;
  caption?: string;
  likes: number;
  liked?: boolean;
  comments: Comment[];
};

export const event = {
  title: "Mariage de Sabrina & Thomas",
  host: "Michelle Lapelouse",
  hostInitials: "ML",
  date: "31 Décembre 2025",
  location: "Château de la Roche-Guyon, 95780",
  cover,
  guests: { invited: 124, coming: 86, maybe: 12 },
  description:
    "Le plus beau jour de notre vie partagé avec vous tous. Postez vos photos, vos vidéos et vos plus beaux moments — on garde tout pour l'éternité.",
  countdown: "31 DÉC",
};

export const photos: Photo[] = [
  {
    id: "1",
    src: p14,
    width: 800,
    height: 1000,
    author: "Carlota Monteiro",
    initials: "CM",
    date: "Il y a 12 min",
    caption: "ILS SONT MARIÉS !!! 🎉👰🤵 Tellement émue d'avoir assisté à ça",
    likes: 247,
    liked: true,
    comments: [
      { id: "c1", author: "Cody Fisher", initials: "CF", text: "Tellement beau ! Félicitations à vous deux 🥰", date: "5 min" },
      { id: "c2", author: "Jane Cooper", initials: "JC", text: "Je pleure 😭❤️", date: "8 min" },
      { id: "c3", author: "Marie L.", initials: "MA", text: "La meilleure photo de la journée 📸", date: "10 min" },
    ],
  },
  {
    id: "2",
    src: p2,
    width: 800,
    height: 1000,
    author: "Damien Breteau",
    initials: "DB",
    date: "Il y a 1 h",
    caption: "Le « oui » qui change tout 💍 Cérémonie magnifique",
    likes: 189,
    liked: true,
    comments: [
      { id: "c4", author: "Sabrina M.", initials: "SM", text: "Merci d'être là 🥹", date: "30 min" },
    ],
  },
  {
    id: "3",
    src: p11,
    width: 800,
    height: 800,
    author: "Léo Martin",
    initials: "LM",
    date: "Il y a 1 h",
    caption: "La première danse… instant suspendu ✨",
    likes: 156,
    comments: [
      { id: "c5", author: "Emma R.", initials: "ER", text: "Cette lumière 😍", date: "45 min" },
      { id: "c6", author: "Tom B.", initials: "TB", text: "Bravo au photographe", date: "20 min" },
    ],
  },
  {
    id: "4",
    src: p4,
    width: 800,
    height: 900,
    author: "Emma Rousseau",
    initials: "ER",
    date: "Il y a 2 h",
    caption: "Cette piste de danse 🔥💃 On a TOUT donné",
    likes: 201,
    comments: [
      { id: "c7", author: "Tom B.", initials: "TB", text: "On a tout cassé ! 🕺", date: "1 h" },
      { id: "c8", author: "Julien P.", initials: "JP", text: "Le DJ était fou", date: "1 h" },
      { id: "c9", author: "Marie L.", initials: "MA", text: "J'ai mal aux pieds 😂", date: "45 min" },
    ],
  },
  {
    id: "5",
    src: p9,
    width: 800,
    height: 800,
    author: "Sabrina M.",
    initials: "SM",
    date: "Il y a 2 h",
    caption: "La pièce montée 🎂 Merci au pâtissier qui a réalisé nos rêves",
    likes: 178,
    liked: true,
    comments: [
      { id: "c10", author: "Cody F.", initials: "CF", text: "Trop belle !", date: "1 h" },
    ],
  },
  {
    id: "6",
    src: p10,
    width: 800,
    height: 1100,
    author: "Julie Dubois",
    initials: "JD",
    date: "Il y a 3 h",
    caption: "Team mariée 💕 Les meilleures",
    likes: 312,
    comments: [
      { id: "c11", author: "Sabrina M.", initials: "SM", text: "Mes amours ❤️", date: "2 h" },
      { id: "c12", author: "Emma R.", initials: "ER", text: "Quelle journée 🥲", date: "2 h" },
    ],
  },
  {
    id: "7",
    src: p3,
    width: 800,
    height: 600,
    author: "Damien Breteau",
    initials: "DB",
    date: "Il y a 4 h",
    caption: "Aux mariés ! 🥂",
    likes: 132,
    liked: true,
    comments: [],
  },
  {
    id: "8",
    src: p1,
    width: 800,
    height: 800,
    author: "Marie Lefèvre",
    initials: "MA",
    date: "Il y a 4 h",
    caption: "La déco était à tomber 🌹 Bravo à l'équipe !",
    likes: 94,
    comments: [
      { id: "c13", author: "Carlota M.", initials: "CM", text: "Ces fleurs 😍", date: "3 h" },
    ],
  },
  {
    id: "9",
    src: p7,
    width: 800,
    height: 1000,
    author: "Anna Garcia",
    initials: "AG",
    date: "Il y a 5 h",
    caption: "Le détail qui dit tout 💍",
    likes: 87,
    comments: [],
  },
  {
    id: "10",
    src: p15,
    width: 800,
    height: 600,
    author: "Thomas R.",
    initials: "TR",
    date: "Il y a 5 h",
    caption: "Cadre de rêve pour un jour de rêve 🌅",
    likes: 165,
    comments: [
      { id: "c14", author: "Léo M.", initials: "LM", text: "Wow, vue incroyable", date: "4 h" },
    ],
  },
  {
    id: "11",
    src: p8,
    width: 800,
    height: 600,
    author: "Sophie Bernard",
    initials: "SB",
    date: "Il y a 6 h",
    caption: "Préparatifs… le calme avant la tempête 💄",
    likes: 73,
    comments: [],
  },
  {
    id: "12",
    src: p12,
    width: 800,
    height: 900,
    author: "Léa Petit",
    initials: "LP",
    date: "Il y a 6 h",
    caption: "Les enfants se sont éclatés 👧🧒",
    likes: 118,
    comments: [
      { id: "c15", author: "Marie L.", initials: "MA", text: "Trop mignons 🥰", date: "5 h" },
    ],
  },
  {
    id: "13",
    src: p13,
    width: 800,
    height: 800,
    author: "Camille Roux",
    initials: "CR",
    date: "Il y a 7 h",
    caption: "Le détail des marque-places ✨",
    likes: 56,
    comments: [],
  },
  {
    id: "14",
    src: p5,
    width: 800,
    height: 800,
    author: "Sabrina M.",
    initials: "SM",
    date: "Il y a 8 h",
    caption: "Mon bouquet 💐",
    likes: 178,
    liked: true,
    comments: [],
  },
  {
    id: "15",
    src: p6,
    width: 800,
    height: 1100,
    author: "Julien Petit",
    initials: "JP",
    date: "Il y a 9 h",
    caption: "La sortie aux étincelles ✨🎇 Magique",
    likes: 412,
    liked: true,
    comments: [
      { id: "c16", author: "Carlota M.", initials: "CM", text: "Cette photo !! 😍", date: "8 h" },
      { id: "c17", author: "Cody F.", initials: "CF", text: "Iconique", date: "7 h" },
      { id: "c18", author: "Damien B.", initials: "DB", text: "À encadrer ✨", date: "6 h" },
    ],
  },
];