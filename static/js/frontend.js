new Vue({
  el: '#app',
  data: {
    state: 'zip',
    noGeolocation: false,
    geoLocationError: false,
    userCoordsObtained: false,
    userCoords: {},
    password: '',
    confirmPassword: '',
    passwordsMatch: true
  },
  methods: {
    switchState(item) {
      this.state = item;
    },
    getLocation() {
      // reset error message if use changes browser settings and tries again
      this.noGeolocation = false;
      this.geoLocationError = false;

      if (!navigator.geolocation){
        return this.noGeolocation = true;
      } else {

        const error = () => {
          this.geoLocationError = true;
        }

        const success = (position) => {
          this.userCoords = { lattitude: position.coords.latitude, longitude: position.coords.longitude };
          this.userCoordsObtained = true;
        }

        navigator.geolocation.getCurrentPosition(success,error);
      }
    },
    passwordMatch(event) {
      if (this.password !== this.confirmPassword) {
        event.preventDefault();
        this.passwordsMatch = false;
      }
    }
  }
})