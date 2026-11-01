const noopAsync = async () => undefined;

const storageRef = () => ({
  put: noopAsync,
  putFile: noopAsync,
  getDownloadURL: async () =>
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80',
});

export const auth = {
  currentUser: null,
};

export const db = {};

export const storage = {
  ref: storageRef,
};

export const functions = {
  httpsCallable:
    () =>
    async () => ({
      data: {
        success: true,
        order_id: 'web-order',
        amount: 0,
        key_id: 'rzp_web_demo',
        ticket_id: 'ticket-web-demo',
      },
    }),
};

export const appCheck = {
  activate: () => undefined,
};
