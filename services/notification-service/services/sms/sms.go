package sms

import (
    "errors"
    "fmt"
    "io/ioutil"
    "net/http"
    "net/url"
    "strings"
)

type Client struct {
    AccountSID string
    AuthToken  string
    From       string
}

func NewClient(accountSID, authToken, from string) *Client {
    return &Client{AccountSID: accountSID, AuthToken: authToken, From: from}
}

func (c *Client) SendSMS(to, message string) error {
    if c == nil {
        return errors.New("sms client not configured")
    }
    if c.AccountSID == "" || c.AuthToken == "" || c.From == "" {
        return errors.New("sms client missing credentials")
    }

    endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", c.AccountSID)
    data := url.Values{}
    data.Set("To", to)
    data.Set("From", c.From)
    data.Set("Body", message)

    req, err := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
    if err != nil {
        return err
    }
    req.SetBasicAuth(c.AccountSID, c.AuthToken)
    req.Header.Add("Accept", "application/json")
    req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        b, _ := ioutil.ReadAll(resp.Body)
        return errors.New(fmt.Sprintf("twilio error: status=%d body=%s", resp.StatusCode, string(b)))
    }
    return nil
}
