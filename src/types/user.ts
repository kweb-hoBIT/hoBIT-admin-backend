export type LoginRequest = {
  body: {
    email: string;
    password: string;
  }
};

export type LoginResponse = {
  statusCode: number;
  message: string;          
  data: {
    accessToken: string;
    refreshToken: string;
    user_id: number;
    username: string;
  };
};

export type SignupRequest = {
  body: {
    email: string;
    password: string;
    username: string;
    phone_num: string;
    invitationKey: string;
  }
};

export type SignupResponse = {
  statusCode: number;
  message: string;
};

export type NewAccessTokenRequest = {
  body: {
    refreshToken: string;
  }
}

export type NewAccessTokenResponse = {
  statusCode: number;
  message: string;
  data: {
    accessToken?: string;
  };
}


export type DeleteAccountReqeust = {
  params: {
    user_id: string
  }
  body: {
  }
}

export type DeleteAccountResponse = {
  statusCode: number;
  message: string
}

export type RefreshTokenRequest = {
  body: {
    refreshToken: string;
  }
}

export type RefreshTokenResponse = {
  statusCode: number;
  message: string;
  data: {
    accessToken?: string;
  };
}


export type User = {
  id: number;
  email: string;
  password: string;
  username: string;
  phone_num: string;
  created_at?: Date;
  updated_at?: Date;
};

export default User;