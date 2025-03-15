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
    user_id: number;
    username: string;
  };
};

export type LogoutRequest = {}

export type LogoutResponse = {
  statusCode: number;
  message: string;
};

export type SignupRequest = {
  body: {
    email: string;
    password: string;
    username: string;
    phone_num: string;
    manageKey: string;
  }
};

export type SignupResponse = {
  statusCode: number;
  message: string;
};

export type NewAccessTokenRequest = {}

export type NewAccessTokenResponse = {
  statusCode: number;
  message: string;
}


export type DeleteAccountReqeust = {
  params: {
    user_id: string
  }
  body: {
    manageKey: string
  }
}

export type DeleteAccountResponse = {
  statusCode: number;
  message: string
}

export type FindUserRequest = {
  body: {
    email: string;
    username: string;
    phone_num: string;
    manageKey: string;
  }
}

export type FindUserResponse = {
  statusCode: number;
  message: string;
  data: {
    user_id: number;
  }
}

export type UpdatePasswordRequest = {
  params: {
    user_id: string;
  };
  body: {
    password: string;
  }
}

export type UpdatePasswordResponse = {
  statusCode: number;
  message: string;
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